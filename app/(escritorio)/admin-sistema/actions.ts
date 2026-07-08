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

export interface ErroLinhaLote {
  linha: number;
  texto: string;
  motivo: string;
}

// Cadastro em lote — pensado pro próprio onboarding do dono do sistema:
// cadastrar veículo virou trabalho manual repetitivo dele mesmo (ver
// criarVeiculoParaEmpresa acima), então colar uma lista copiada de
// planilha (uma linha por veículo, campos separados por TAB ou vírgula)
// economiza o que hoje é o gargalo real do negócio — o tempo de quem
// onboarda cada cliente novo. Só os campos que dá pra saber "de cabeça"
// olhando uma frota (placa/prefixo/modelo/marca/ano) — capacidade de
// tanque, tipo de combustível e consumo de referência ficam pro cadastro
// individual depois (menos comum saber de cabeça, e a empresa cliente já
// pode editar isso sozinha). Nunca falha tudo por causa de UMA linha
// ruim — cada linha é validada e inserida separadamente, erro de uma não
// derruba as outras (resultado parcial, não tudo-ou-nada).
export async function criarVeiculosEmLote(
  empresaId: string,
  texto: string
): Promise<Resultado<{ criados: number; erros: ErroLinhaLote[] }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  if (!ehDonoSistema(user.email)) {
    return { error: "Só o dono do sistema pode cadastrar veículos." };
  }

  const admin = createAdminClient();
  const { data: empresa } = await admin.from("empresas").select("id").eq("id", empresaId).single();
  if (!empresa) return { error: "Empresa não encontrada." };

  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (linhas.length === 0) {
    return { error: "Cole ao menos uma linha (placa, prefixo, modelo, marca, ano)." };
  }

  const campo = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : undefined);

  let criados = 0;
  const erros: ErroLinhaLote[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    // TAB é o separador natural ao colar de uma planilha (Excel/Sheets);
    // vírgula funciona pra quem digitar/colar texto simples.
    const partes = linha.includes("\t") ? linha.split("\t") : linha.split(",");
    const [placa, prefixo, modelo, marca, ano] = partes.map((p) => p?.trim());

    const parsed = veiculoSchema.safeParse({
      placa: campo(placa) ?? "",
      prefixo: campo(prefixo),
      modelo: campo(modelo),
      marca: campo(marca),
      ano: campo(ano),
    });

    if (!parsed.success) {
      erros.push({ linha: i + 1, texto: linha, motivo: parsed.error.issues[0]?.message ?? "Dados inválidos." });
      continue;
    }

    const { error } = await admin.from("veiculos").insert({ ...parsed.data, empresa_id: empresaId });
    if (error) {
      erros.push({
        linha: i + 1,
        texto: linha,
        motivo: error.code === "23505" ? "Já existe um veículo com essa placa nesta empresa." : "Não foi possível cadastrar.",
      });
      continue;
    }
    criados++;
  }

  revalidatePath("/admin-sistema");
  return { data: { criados, erros } };
}
