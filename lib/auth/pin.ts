import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitarPin } from "@/lib/rate-limit";

export const REGEX_PIN = /^\d{6}$/;

const TAMANHO_HASH_BYTES = 64;

// scrypt (nativo do Node, sem dependência nova) com salt aleatório por
// usuário — mesmo que o hash vazasse, um PIN de 6 dígitos (1 milhão de
// combinações) não pode ser testado em lote contra um hash rápido; scrypt é
// deliberadamente caro de calcular, o que encarece a força bruta mesmo com
// baixa entropia de entrada. Formato armazenado: "<salt hex>:<hash hex>".
export function gerarHashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, TAMANHO_HASH_BYTES).toString("hex");
  return `${salt}:${hash}`;
}

function compararHashPin(pin: string, hashArmazenado: string): boolean {
  const [salt, hashEsperadoHex] = hashArmazenado.split(":");
  if (!salt || !hashEsperadoHex) return false;

  const hashCalculado = scryptSync(pin, salt, TAMANHO_HASH_BYTES);
  const hashEsperado = Buffer.from(hashEsperadoHex, "hex");
  if (hashCalculado.length !== hashEsperado.length) return false;

  // timingSafeEqual em vez de `===`: comparação de string vaza timing
  // (quanto mais caracteres batem, mais devagar retorna), o que permite
  // reconstruir o hash byte a byte num ataque de timing. Não é crítico pra
  // um PIN de 6 dígitos atrás de rate limit nenhum ainda, mas é a forma
  // correta de comparar segredo — mesmo espírito de nunca subestimar defesa
  // em profundidade neste projeto.
  return timingSafeEqual(hashCalculado, hashEsperado);
}

// Único ponto de leitura de `usuarios.pin_hash` no projeto inteiro — SEMPRE
// via service role, nunca pela sessão do usuário. A policy `usuarios_select`
// (0001_init.sql) libera ler qualquer colega da mesma empresa (necessário
// pra Configurações listar o time); se este SELECT corresse pelo client
// autenticado, qualquer usuário logado poderia ler o hash de PIN de
// qualquer colega só trocando o `id` na query.
//
// Também é o único ponto por onde as 3 chamadas reais de verificação de PIN
// passam (exclusão de abastecimento, export Excel/PDF, export de fotos) —
// por isso o rate limit entra aqui, e não em cada call site: garante que
// nenhum deles esqueça de aplicar o limite. Estourar o limite retorna
// `false`, igual a PIN errado — nunca revela pro chamador que o motivo foi
// rate limit em vez de PIN incorreto, o que evitaria dar uma pista extra
// pra quem está tentando adivinhar.
export async function verificarPinDoUsuario(usuarioId: string, pin: string): Promise<boolean> {
  if (!REGEX_PIN.test(pin)) return false;

  const { permitido } = await limitarPin(usuarioId);
  if (!permitido) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("usuarios")
    .select("pin_hash")
    .eq("id", usuarioId)
    .single();

  if (!data?.pin_hash) return false;
  return compararHashPin(pin, data.pin_hash);
}
