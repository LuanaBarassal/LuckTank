"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { registrarLog } from "@/lib/edicoes-log";
import { motoristaSchema } from "@/lib/validacao/schemas";

type Resultado<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

function podeGerenciarMotoristas(papel: string) {
  return papel === "gerente" || papel === "administrador";
}

export async function criarMotorista(payload: unknown): Promise<Resultado<{ id: string }>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };
  if (!podeGerenciarMotoristas(usuario.papel)) {
    return { error: "Só gerente ou administrador podem cadastrar motoristas." };
  }

  const parsed = motoristaSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("motoristas")
    .insert({ ...parsed.data, empresa_id: usuario.empresa_id })
    .select()
    .single();

  if (error) return { error: "Não foi possível cadastrar o motorista." };

  await registrarLog({
    empresaId: usuario.empresa_id,
    tabela: "motoristas",
    registroId: data.id,
    usuarioId: usuario.id,
    acao: "insert",
    antes: null,
    depois: data,
  });

  revalidatePath("/motoristas");
  return { data: { id: data.id } };
}

export async function atualizarMotorista(id: string, payload: unknown): Promise<Resultado<{ id: string }>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };
  if (!podeGerenciarMotoristas(usuario.papel)) {
    return { error: "Só gerente ou administrador podem editar motoristas." };
  }

  const parsed = motoristaSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: antes } = await supabase.from("motoristas").select("*").eq("id", id).single();
  if (!antes) return { error: "Motorista não encontrado." };

  const { data: depois, error } = await supabase
    .from("motoristas")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: "Não foi possível salvar as alterações." };

  await registrarLog({
    empresaId: usuario.empresa_id,
    tabela: "motoristas",
    registroId: id,
    usuarioId: usuario.id,
    acao: "update",
    antes,
    depois,
  });

  revalidatePath("/motoristas");
  return { data: { id } };
}

export async function alternarAtivoMotorista(id: string, ativo: boolean): Promise<Resultado<{ id: string }>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };
  if (!podeGerenciarMotoristas(usuario.papel)) {
    return { error: "Só gerente ou administrador podem ativar/inativar motoristas." };
  }

  const supabase = await createClient();
  const { data: antes } = await supabase.from("motoristas").select("*").eq("id", id).single();
  if (!antes) return { error: "Motorista não encontrado." };

  const { data: depois, error } = await supabase
    .from("motoristas")
    .update({ ativo })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: "Não foi possível atualizar." };

  await registrarLog({
    empresaId: usuario.empresa_id,
    tabela: "motoristas",
    registroId: id,
    usuarioId: usuario.id,
    acao: ativo ? "update" : "delete",
    antes,
    depois,
  });

  revalidatePath("/motoristas");
  return { data: { id } };
}
