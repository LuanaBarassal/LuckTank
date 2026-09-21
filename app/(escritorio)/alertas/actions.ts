"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";

// Resolver um alerta é uma ação operacional leve (tipo "marcar como lido"),
// não uma edição de dado de negócio — por isso não passa por edicoes_log
// (isso é pra auditar mudanças em veículos/motoristas/usuários/abastecimentos,
// não o estado do próprio sistema de alertas). Restrito a gerente/
// administrador (migration 0018 — achado de auditoria: antes qualquer
// usuário da empresa, inclusive supervisor, podia silenciar um alerta
// crítico de fraude sozinho). A policy `alertas_update` já barra isso no
// banco; a checagem aqui é só pra devolver um erro claro em vez de um erro
// genérico de RLS.
export async function resolverAlerta(id: string) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };
  if (usuario.papel !== "gerente" && usuario.papel !== "administrador") {
    return { error: "Só gerente ou administrador pode resolver um alerta." };
  }

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
