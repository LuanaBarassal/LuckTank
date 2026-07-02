"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { registrarLog } from "@/lib/edicoes-log";
import { veiculoSchema, veiculoEdicaoSchema } from "@/lib/validacao/schemas";

type Resultado<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export async function criarVeiculo(payload: unknown): Promise<Resultado<{ id: string }>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };
  if (usuario.papel !== "administrador") {
    return { error: "Só administradores podem cadastrar veículos." };
  }

  const parsed = veiculoSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("veiculos")
    .insert({ ...parsed.data, empresa_id: usuario.empresa_id })
    .select()
    .single();

  if (error) {
    return { error: error.code === "23505" ? "Já existe um veículo com essa placa." : "Não foi possível cadastrar." };
  }

  await registrarLog({
    empresaId: usuario.empresa_id,
    tabela: "veiculos",
    registroId: data.id,
    usuarioId: usuario.id,
    acao: "insert",
    antes: null,
    depois: data,
  });

  revalidatePath("/onibus");
  return { data: { id: data.id } };
}

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
