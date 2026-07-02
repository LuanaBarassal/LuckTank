"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";

// Resolver um alerta é uma ação operacional leve (tipo "marcar como lido"),
// não uma edição de dado de negócio — por isso não passa por edicoes_log
// (isso é pra auditar mudanças em veículos/motoristas/usuários/abastecimentos,
// não o estado do próprio sistema de alertas). A policy `alertas_update` já
// libera qualquer usuário autenticado da empresa, sem exigir papel específico.
export async function resolverAlerta(id: string) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("alertas")
    .update({
      resolvido: true,
      resolvido_por: usuario.id,
      resolvido_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "Não foi possível resolver o alerta." };

  revalidatePath("/alertas");
  return { data: true };
}
