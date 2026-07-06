"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehDonoSistema } from "@/lib/auth/dono-sistema";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarEmpresaSchema } from "@/lib/validacao/schemas";

type Resultado<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

// Cria uma empresa (tenant) nova, isolada de tudo que já existe (RLS separa
// por empresa_id desde a 0001), e convida o primeiro administrador dela por
// e-mail — mesmo mecanismo de convidarUsuario (app/(escritorio)/configuracoes/actions.ts):
// a pessoa convidada define a própria senha ao aceitar, nunca passa por
// aqui em texto puro. Checa o e-mail puro da sessão (não getUsuarioAtual())
// pelo mesmo motivo da página: o dono do sistema não precisa pertencer a
// nenhuma empresa pra ter esse acesso.
export async function criarEmpresa(payload: unknown): Promise<Resultado<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  if (!ehDonoSistema(user.email)) {
    return { error: "Só o dono do sistema pode criar empresas." };
  }

  const parsed = criarEmpresaSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();

  const { data: empresa, error: erroEmpresa } = await admin
    .from("empresas")
    .insert({ nome: parsed.data.nomeEmpresa })
    .select()
    .single();

  if (erroEmpresa) {
    return { error: "Não foi possível criar a empresa." };
  }

  const { data: convite, error: erroConvite } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.emailAdministrador
  );

  if (erroConvite || !convite.user) {
    // Empresa já foi criada — desfaz, pra não deixar um tenant órfão sem
    // nenhum usuário (mesmo raciocínio de convidarUsuario desfazendo o
    // usuário de auth quando o insert em `usuarios` falha).
    await admin.from("empresas").delete().eq("id", empresa.id);
    const jaExiste = erroConvite?.message?.toLowerCase().includes("already");
    return {
      error: jaExiste
        ? "Esse e-mail já está cadastrado em outra empresa."
        : "Não foi possível enviar o convite.",
    };
  }

  const { error: erroUsuario } = await admin.from("usuarios").insert({
    id: convite.user.id,
    empresa_id: empresa.id,
    nome: parsed.data.nomeAdministrador,
    email: parsed.data.emailAdministrador,
    papel: "administrador",
  });

  if (erroUsuario) {
    await admin.auth.admin.deleteUser(convite.user.id);
    await admin.from("empresas").delete().eq("id", empresa.id);
    return { error: "Não foi possível concluir o cadastro da empresa." };
  }

  revalidatePath("/admin-sistema");
  return { data: { id: empresa.id } };
}
