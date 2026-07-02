"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarLog } from "@/lib/edicoes-log";
import { convidarUsuarioSchema } from "@/lib/validacao/schemas";

type Resultado<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

// Convidar usuário exige a Auth Admin API (service role) de qualquer forma —
// por isso o papel de quem está chamando é checado aqui manualmente, e não
// via uma policy de RLS na tabela usuarios (que o admin client ignora mesmo).
export async function convidarUsuario(payload: unknown): Promise<Resultado<{ id: string }>> {
  const usuarioAtual = await getUsuarioAtual();
  if (!usuarioAtual) return { error: "Não autenticado." };
  if (usuarioAtual.papel !== "administrador") {
    return { error: "Só administradores podem convidar usuários." };
  }

  const parsed = convidarUsuarioSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();

  const { data: convite, error: conviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email
  );

  if (conviteError || !convite.user) {
    const jaExiste = conviteError?.message?.toLowerCase().includes("already");
    return {
      error: jaExiste
        ? "Esse e-mail já está cadastrado."
        : "Não foi possível enviar o convite.",
    };
  }

  const { data: usuarioNovo, error: insertError } = await admin
    .from("usuarios")
    .insert({
      id: convite.user.id,
      empresa_id: usuarioAtual.empresa_id,
      nome: parsed.data.nome,
      email: parsed.data.email,
      papel: parsed.data.papel,
    })
    .select()
    .single();

  if (insertError) {
    // convite de auth já foi enviado mas o registro em `usuarios` falhou —
    // desfaz o usuário de auth pra não deixar um convite "órfão" sem empresa/papel.
    await admin.auth.admin.deleteUser(convite.user.id);
    return { error: "Não foi possível concluir o cadastro do usuário." };
  }

  await registrarLog({
    empresaId: usuarioAtual.empresa_id,
    tabela: "usuarios",
    registroId: usuarioNovo.id,
    usuarioId: usuarioAtual.id,
    acao: "insert",
    antes: null,
    depois: usuarioNovo,
  });

  revalidatePath("/configuracoes");
  return { data: { id: usuarioNovo.id } };
}
