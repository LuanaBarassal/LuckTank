"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehDonoSistema } from "@/lib/auth/dono-sistema";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarEmpresaSchema, convidarUsuarioSchema, veiculoSchema } from "@/lib/validacao/schemas";
import { urlBaseAtual } from "@/lib/url-atual";

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
    parsed.data.emailAdministrador,
    { redirectTo: `${await urlBaseAtual()}/definir-senha` }
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

// Convidar usuário pra uma empresa JÁ EXISTENTE — saiu de dentro da própria
// empresa (Configurações) de propósito: só o LuckTank adiciona gente nova
// agora, pra sempre saber quem tem acesso a cada cliente. Mesmo mecanismo de
// convite por e-mail de criarEmpresa acima, só que aqui a empresa já existe
// e é escolhida na tela em vez de criada junto.
export async function convidarUsuarioParaEmpresa(
  empresaId: string,
  payload: unknown
): Promise<Resultado<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  if (!ehDonoSistema(user.email)) {
    return { error: "Só o dono do sistema pode convidar usuários." };
  }

  const parsed = convidarUsuarioSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();

  const { data: empresa } = await admin.from("empresas").select("id").eq("id", empresaId).single();
  if (!empresa) return { error: "Empresa não encontrada." };

  const { data: convite, error: conviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: `${await urlBaseAtual()}/definir-senha` }
  );

  if (conviteError || !convite.user) {
    const jaExiste = conviteError?.message?.toLowerCase().includes("already");
    return {
      error: jaExiste ? "Esse e-mail já está cadastrado." : "Não foi possível enviar o convite.",
    };
  }

  const { data: usuarioNovo, error: insertError } = await admin
    .from("usuarios")
    .insert({
      id: convite.user.id,
      empresa_id: empresaId,
      nome: parsed.data.nome,
      email: parsed.data.email,
      papel: parsed.data.papel,
    })
    .select()
    .single();

  if (insertError) {
    await admin.auth.admin.deleteUser(convite.user.id);
    return { error: "Não foi possível concluir o cadastro do usuário." };
  }

  // Sem registrarLog aqui, mesmo motivo de criarEmpresa acima não logar:
  // edicoes_log.usuario_id tem FK pra usuarios(id), e o dono do sistema
  // normalmente não tem linha própria em usuarios nas empresas que ele não
  // administra — logar com o id dele seria uma FK tecnicamente válida, mas
  // atribuiria a ação à pessoa errada.

  revalidatePath("/admin-sistema");
  return { data: { id: usuarioNovo.id } };
}

// Cadastrar veículo pra uma empresa já existente — mesma mudança de
// propriedade de "Convidar usuário": só o LuckTank adiciona veículo agora
// (ver onibus/actions.ts, que perdeu criarVeiculo). Sem upload de foto aqui
// de propósito — o bucket é isolado por empresa via sessão do usuário
// dela, o dono do sistema agindo fora de qualquer empresa não teria uma
// sessão com esse escopo; se o cliente quiser foto, edita o veículo depois
// (edição continua liberada pra gerente/administrador da própria empresa).
export async function criarVeiculoParaEmpresa(
  empresaId: string,
  payload: unknown
): Promise<Resultado<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  if (!ehDonoSistema(user.email)) {
    return { error: "Só o dono do sistema pode cadastrar veículos." };
  }

  const parsed = veiculoSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();

  const { data: empresa } = await admin.from("empresas").select("id").eq("id", empresaId).single();
  if (!empresa) return { error: "Empresa não encontrada." };

  const { data, error } = await admin
    .from("veiculos")
    .insert({ ...parsed.data, empresa_id: empresaId })
    .select()
    .single();

  if (error) {
    return {
      error: error.code === "23505" ? "Já existe um veículo com essa placa." : "Não foi possível cadastrar.",
    };
  }

  revalidatePath("/admin-sistema");
  return { data: { id: data.id } };
}
