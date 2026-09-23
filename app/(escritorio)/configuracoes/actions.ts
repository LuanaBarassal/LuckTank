"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarLog } from "@/lib/edicoes-log";
import { gerarHashPin, REGEX_PIN } from "@/lib/auth/pin";
import { emailNotificacaoSchema, dadosNotaFiscalSchema } from "@/lib/validacao/schemas";

type Resultado<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

// Cada usuário define o PRÓPRIO PIN — nunca administra o PIN de outro
// usuário por aqui (mesmo se administrador). Sempre via service role: a
// policy `usuarios_update` (0003) só libera administrador, e "definir meu
// próprio PIN" precisa valer pra qualquer papel, então essa checagem de
// permissão é feita aqui no código (getUsuarioAtual == quem está editando),
// não pela policy de RLS.
export async function definirPin(pin: string, confirmarPin: string): Promise<Resultado<true>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };

  if (!REGEX_PIN.test(pin)) {
    return { error: "O PIN deve ter exatamente 6 dígitos." };
  }
  if (pin !== confirmarPin) {
    return { error: "Os PINs não coincidem." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("usuarios")
    .update({ pin_hash: gerarHashPin(pin) })
    .eq("id", usuario.id);

  if (error) return { error: "Não foi possível salvar o PIN." };

  // Nunca grava o PIN nem o hash no log — só o fato de ter sido alterado.
  await registrarLog({
    empresaId: usuario.empresa_id,
    tabela: "usuarios",
    registroId: usuario.id,
    usuarioId: usuario.id,
    acao: "update",
    antes: { pin_hash: "[redigido]" },
    depois: { pin_hash: "[redigido]" },
  });

  revalidatePath("/configuracoes");
  return { data: true };
}

// Self-service: qualquer administrador da PRÓPRIA empresa pode editar a
// caixa que recebe o e-mail de "abastecimento registrado" — diferente do
// resto do cadastro (veículo/usuário), que é exclusivo do dono do sistema
// desde a centralização (2026-07-07). Faz sentido abrir aqui porque isso não
// é "empréstimo de conta" nenhum, é só uma preferência operacional de qual
// inbox lê os avisos — o mesmo campo também é editável por fora, em
// /admin-sistema, pro dono do sistema já deixar configurado no onboarding.
// `empresaId` nunca vem do client — sempre o da sessão de quem está editando.
export async function atualizarEmailNotificacaoPropria(email: string | null): Promise<Resultado<true>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };
  if (usuario.papel !== "administrador") {
    return { error: "Só administradores podem editar o e-mail de notificação." };
  }

  const parsed = emailNotificacaoSchema.safeParse(email?.trim() || null);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "E-mail inválido." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("empresas")
    .update({ email_notificacao: parsed.data })
    .eq("id", usuario.empresa_id);

  if (error) return { error: "Não foi possível salvar o e-mail." };

  revalidatePath("/configuracoes");
  return { data: true };
}

export async function temPinDefinido(): Promise<boolean> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return false;

  const admin = createAdminClient();
  const { data } = await admin.from("usuarios").select("pin_hash").eq("id", usuario.id).single();
  return Boolean(data?.pin_hash);
}

// Dados pra pedir/enviar a nota fiscal (0020) — CNPJ em que o posto emite a
// NF e o WhatsApp/e-mail pra onde vai o comprovante. Aparecem na etiqueta
// impressa do QR, na etapa da NF do motorista e nos botões de envio. Mesmo
// self-service do e-mail de notificação (administrador da PRÓPRIA empresa,
// `empresa_id` sempre da sessão), mas COM edicoes_log: é o CNPJ em que a
// empresa recebe nota fiscal — trocar isso sem rastro seria um jeito fácil
// de desviar nota pra outro CNPJ.
export async function atualizarDadosNotaFiscal(payload: unknown): Promise<Resultado<true>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };
  if (usuario.papel !== "administrador") {
    return { error: "Só administradores podem editar os dados da nota fiscal." };
  }

  const parsed = dadosNotaFiscalSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();
  const { data: antes } = await admin
    .from("empresas")
    .select("nota_fiscal_cnpj, nota_fiscal_whatsapp, nota_fiscal_email")
    .eq("id", usuario.empresa_id)
    .single();

  const { data: depois, error } = await admin
    .from("empresas")
    .update({
      nota_fiscal_cnpj: parsed.data.cnpj,
      nota_fiscal_whatsapp: parsed.data.whatsapp,
      nota_fiscal_email: parsed.data.email,
    })
    .eq("id", usuario.empresa_id)
    .select("nota_fiscal_cnpj, nota_fiscal_whatsapp, nota_fiscal_email")
    .single();

  if (error || !depois) return { error: "Não foi possível salvar os dados da nota fiscal." };

  await registrarLog({
    empresaId: usuario.empresa_id,
    tabela: "empresas",
    registroId: usuario.empresa_id,
    usuarioId: usuario.id,
    acao: "update",
    antes,
    depois,
  });

  revalidatePath("/configuracoes");
  return { data: true };
}
