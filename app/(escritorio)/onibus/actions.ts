"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { registrarLog } from "@/lib/edicoes-log";
import { verificarPinDoUsuario } from "@/lib/auth/pin";
import { veiculoEdicaoSchema } from "@/lib/validacao/schemas";

type Resultado<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

// Cadastro de veículo novo saiu daqui — só o LuckTank adiciona veículo a uma
// empresa agora (ver criarVeiculoParaEmpresa em admin-sistema/actions.ts).
// Edição de veículo já existente continua igual, sem mudança de permissão.
export async function atualizarVeiculo(id: string, payload: unknown): Promise<Resultado<{ id: string }>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };
  if (!["gerente", "administrador"].includes(usuario.papel)) {
    return { error: "Você não tem permissão para editar veículos." };
  }

  const parsed = veiculoEdicaoSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: antes } = await supabase.from("veiculos").select("*").eq("id", id).single();
  if (!antes) return { error: "Veículo não encontrado." };

  // parsed.data só contém os campos do schema de edição — qr_token não existe
  // nesse schema, então não tem como esta chamada sobrescrevê-lo.
  const { data: depois, error } = await supabase
    .from("veiculos")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: "Não foi possível salvar as alterações." };

  await registrarLog({
    empresaId: usuario.empresa_id,
    tabela: "veiculos",
    registroId: id,
    usuarioId: usuario.id,
    acao: "update",
    antes,
    depois,
  });

  revalidatePath("/onibus");
  revalidatePath(`/onibus/${id}`);
  return { data: { id } };
}

// Exclusão de abastecimento — invariante #4 do projeto (nunca reabrir uma
// policy de RLS de UPDATE/DELETE pra abastecimentos, ver 0006): todo o
// caminho passa pela service role, com a checagem de papel e de PIN feitas
// aqui no código antes de mutar. Soft delete (status = 'excluido'), nunca
// DELETE de linha de verdade — mantém a trilha de auditoria e o histórico
// intacto, mesmo padrão de `alternarAtivoVeiculo` pra veículos.
export async function excluirAbastecimento(id: string, pin: string): Promise<Resultado<{ id: string }>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };
  if (!["gerente", "administrador"].includes(usuario.papel)) {
    return { error: "Só gerente ou administrador podem excluir abastecimentos." };
  }

  const pinValido = await verificarPinDoUsuario(usuario.id, pin);
  if (!pinValido) {
    return { error: "PIN incorreto ou não configurado. Configure em Configurações." };
  }

  const admin = createAdminClient();

  // Nunca confia em `id` sozinho — reconfirma que pertence à empresa de
  // quem está chamando, mesmo vindo de uma Server Action (não de input
  // arbitrário de rota pública, mas o princípio é o mesmo do resto do app).
  const { data: antes } = await admin
    .from("abastecimentos")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", usuario.empresa_id)
    .single();

  if (!antes) return { error: "Abastecimento não encontrado." };
  if (antes.status !== "ativo") return { error: "Este abastecimento já foi excluído." };

  const { data: depois, error } = await admin
    .from("abastecimentos")
    .update({
      status: "excluido",
      excluido_por: usuario.id,
      excluido_em: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !depois) return { error: "Não foi possível excluir." };

  await registrarLog({
    empresaId: usuario.empresa_id,
    tabela: "abastecimentos",
    registroId: id,
    usuarioId: usuario.id,
    acao: "delete",
    antes,
    depois,
  });

  // km_atual do veículo foi setado pelo trigger de INSERT deste (ou de outro)
  // abastecimento — excluir não reverte isso sozinho. Recalcula a partir do
  // abastecimento ativo mais recente que sobrou; se não sobrar nenhum, deixa
  // como está (não há valor "original" registrado em lugar nenhum pra
  // restaurar com segurança).
  const { data: maisRecente } = await admin
    .from("abastecimentos")
    .select("km_atual")
    .eq("veiculo_id", antes.veiculo_id)
    .eq("status", "ativo")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maisRecente) {
    await admin.from("veiculos").update({ km_atual: maisRecente.km_atual }).eq("id", antes.veiculo_id);
  }

  // Alertas gerados pra este abastecimento (ver lib/validacao/regras.ts) não
  // fazem sentido mais uma vez que o registro que os disparou não existe
  // mais como ativo — sem isso, ficavam pendentes pra sempre em /alertas,
  // sem nenhuma indicação de que o abastecimento por trás foi excluído
  // (achado testando esta função: um abastecimento de teste excluído
  // deixou 2 alertas de "atenção" órfãos no painel). `resolvido_por`/`em`
  // ficam como o próprio usuário que excluiu — resolver aqui não é edição
  // de dado de negócio (mesmo raciocínio de `resolverAlerta` em
  // alertas/actions.ts), então não passa por edicoes_log.
  await admin
    .from("alertas")
    .update({ resolvido: true, resolvido_por: usuario.id, resolvido_em: new Date().toISOString() })
    .eq("entidade_tipo", "abastecimento")
    .eq("entidade_id", id)
    .eq("resolvido", false);

  revalidatePath(`/onibus/${antes.veiculo_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/alertas");
  return { data: { id } };
}

export async function alternarAtivoVeiculo(id: string, ativo: boolean): Promise<Resultado<{ id: string }>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };
  if (!["gerente", "administrador"].includes(usuario.papel)) {
    return { error: "Só gerente ou administrador podem excluir/reativar veículos." };
  }

  const supabase = await createClient();
  const { data: antes } = await supabase.from("veiculos").select("*").eq("id", id).single();
  if (!antes) return { error: "Veículo não encontrado." };

  const { data: depois, error } = await supabase
    .from("veiculos")
    .update({ ativo })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: "Não foi possível atualizar." };

  await registrarLog({
    empresaId: usuario.empresa_id,
    tabela: "veiculos",
    registroId: id,
    usuarioId: usuario.id,
    acao: ativo ? "update" : "delete",
    antes,
    depois,
  });

  revalidatePath("/onibus");
  revalidatePath(`/onibus/${id}`);
  return { data: { id } };
}
