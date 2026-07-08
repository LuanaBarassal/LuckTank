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

// Data de renovação é só um lembrete pro dono do sistema — não bloqueia
// nada no app nem no acesso do cliente (a venda é manual, não existe
// cobrança automática pra reagir a vencimento). `null` explícito limpa o
// campo (empresa sem data marcada ainda).
export async function atualizarProximaRenovacao(
  empresaId: string,
  data: string | null
): Promise<Resultado<true>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  if (!ehDonoSistema(user.email)) {
    return { error: "Só o dono do sistema pode editar isso." };
  }

  if (data !== null && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { error: "Data inválida." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("empresas")
    .update({ proxima_renovacao: data })
    .eq("id", empresaId);

  if (error) return { error: "Não foi possível salvar a data." };

  revalidatePath("/admin-sistema");
  return { data: true };
}

// Suspende ou reativa o ACESSO de um usuário (não apaga nada) — usa o
// banimento nativo do Supabase Auth (`ban_duration`), que bloqueia login e
// renovação de sessão em nível de autenticação, antes de qualquer RLS.
// Preferível a excluir de verdade quando o objetivo é só "cliente parou de
// pagar, corta o acesso": reversível a qualquer momento, não perde nenhum
// dado nem quebra `edicoes_log`/`alertas` que referenciam esse usuário (ver
// excluirUsuario abaixo pra entender por que exclusão de verdade é mais
// arriscada). Uma sessão já aberta no navegador pode levar até ~1h pra ser
// cortada de fato (tempo de expiração do access token atual) — o bloqueio
// de LOGIN NOVO é imediato.
export async function suspenderUsuario(
  usuarioId: string,
  suspender: boolean
): Promise<Resultado<true>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  if (!ehDonoSistema(user.email)) {
    return { error: "Só o dono do sistema pode suspender ou reativar acesso." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(usuarioId, {
    ban_duration: suspender ? "87600h" : "none",
  });

  if (error) return { error: "Não foi possível atualizar o acesso." };

  revalidatePath("/admin-sistema");
  return { data: true };
}

// Suspende/reativa TODOS os usuários de uma empresa de uma vez — cobre o
// caso mais comum na prática ("esse cliente parou de pagar, corta tudo"),
// sem precisar clicar usuário por usuário.
export async function suspenderEmpresa(
  empresaId: string,
  suspender: boolean
): Promise<Resultado<{ afetados: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  if (!ehDonoSistema(user.email)) {
    return { error: "Só o dono do sistema pode suspender ou reativar acesso." };
  }

  const admin = createAdminClient();
  const { data: usuarios, error: erroBusca } = await admin
    .from("usuarios")
    .select("id")
    .eq("empresa_id", empresaId);

  if (erroBusca) return { error: "Não foi possível buscar os usuários da empresa." };

  let afetados = 0;
  for (const usuario of usuarios ?? []) {
    const { error } = await admin.auth.admin.updateUserById(usuario.id, {
      ban_duration: suspender ? "87600h" : "none",
    });
    if (!error) afetados++;
  }

  revalidatePath("/admin-sistema");
  return { data: { afetados } };
}

// Exclusão DE VERDADE do login de um usuário (não é soft-delete). Diferente
// do resto do app (abastecimento é soft-delete, status='excluido'), aqui
// apagamos o usuário do Supabase Auth mesmo — `usuarios.id` referencia
// `auth.users(id) on delete cascade` (0001_init.sql), então a linha em
// `usuarios` some junto automaticamente.
//
// RISCO REAL que motivou a checagem abaixo: `edicoes_log.usuario_id`,
// `abastecimentos.editado_por/excluido_por` e `alertas.resolvido_por`
// referenciam `usuarios(id)` SEM "on delete cascade" nem "set null" — ou
// seja, se esse usuário já editou/excluiu algo ou resolveu um alerta
// alguma vez, o Postgres BLOQUEIA a exclusão (viola FK), de propósito:
// isso é o invariante #4 do produto (trilha de auditoria não pode
// desaparecer) protegendo até de mim.
//
// Testado ao vivo (script isolado, empresa/usuários descartáveis) que o
// erro que o Supabase devolve quando a exclusão é barrada por essa FK vem
// **vazio** (`{}`, sem `message` nenhuma) — não dá pra confiar em nenhum
// texto de erro pra detectar esse caso. Por isso a checagem é feita ANTES
// de tentar excluir (consulta direta nas 3 tabelas), não depois: se
// encontrar qualquer rastro, nem chega a chamar `deleteUser`.
export async function excluirUsuario(usuarioId: string): Promise<Resultado<true>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  if (!ehDonoSistema(user.email)) {
    return { error: "Só o dono do sistema pode excluir contas." };
  }

  const admin = createAdminClient();

  const [{ data: logs }, { data: alertasResolvidos }, { data: abastecimentosEditados }] =
    await Promise.all([
      admin.from("edicoes_log").select("id").eq("usuario_id", usuarioId).limit(1),
      admin.from("alertas").select("id").eq("resolvido_por", usuarioId).limit(1),
      admin
        .from("abastecimentos")
        .select("id")
        .or(`editado_por.eq.${usuarioId},excluido_por.eq.${usuarioId}`)
        .limit(1),
    ]);

  if (logs?.length || alertasResolvidos?.length || abastecimentosEditados?.length) {
    return {
      error:
        'Esse usuário já editou/excluiu algo ou resolveu um alerta — excluir apagaria rastro de auditoria. Use "Suspender" em vez de excluir.',
    };
  }

  const { error } = await admin.auth.admin.deleteUser(usuarioId);
  if (error) return { error: "Não foi possível excluir esse usuário." };

  revalidatePath("/admin-sistema");
  return { data: true };
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
