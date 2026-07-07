"use server";

// Verificação de PIN chamada a partir de Client Components (modal de
// desbloqueio) em várias telas diferentes (dashboard, aba do ônibus,
// exclusão de abastecimento) — por isso mora em lib/auth, não dentro de um
// único actions.ts de rota. A lógica de fato (ler o hash via service role,
// comparar) vive em lib/auth/pin.ts; aqui só resolve QUEM está perguntando.

import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { verificarPinDoUsuario } from "@/lib/auth/pin";

export async function verificarPinUsuarioAtual(pin: string): Promise<boolean> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return false;
  return verificarPinDoUsuario(usuario.id, pin);
}
