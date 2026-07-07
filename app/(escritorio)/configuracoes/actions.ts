"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarLog } from "@/lib/edicoes-log";
import { convidarUsuarioSchema } from "@/lib/validacao/schemas";
import { urlBaseAtual } from "@/lib/url-atual";
import { gerarHashPin, REGEX_PIN } from "@/lib/auth/pin";

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

  // redirectTo explícito — sem isso o Supabase manda pro "Site URL" padrão
  // do projeto, que pode não ser onde /definir-senha mora neste ambiente
  // (dev x preview x produção). Precisa estar na lista de "Redirect URLs"
  // permitidas no painel do Supabase (Authentication > URL Configuration).
  const { data: convite, error: conviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: `${await urlBaseAtual()}/definir-senha` }
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

// Cada usuário define o PRÓPRIO PIN — nunca administra o PIN de outro
// usuário por aqui (mesmo se administrador). Sempre via service role: a
// policy `usuarios_update` (0003) só libera administrador, e "definir meu
// próprio PIN" precisa valer pra qualquer papel, então essa checagem de
// permissão é feita aqui no código (getUsuarioAtual == quem está editando),
// não pela policy de RLS.
export async function definirPin(pin: string, confirmarPin: string): Promise<Resultado<true>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Não autenticado." };

  if (!REGEX_PIN.test(pin)) {
    return { error: "O PIN deve ter exatamente 6 dígitos." };
  }
  if (pin !== confirmarPin) {
    return { error: "Os PINs não coincidem." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("usuarios")
    .update({ pin_hash: gerarHashPin(pin) })
    .eq("id", usuario.id);

  if (error) return { error: "Não foi possível salvar o PIN." };

  // Nunca grava o PIN nem o hash no log — só o fato de ter sido alterado.
  await registrarLog({
    empresaId: usuario.empresa_id,
    tabela: "usuarios",
    registroId: usuario.id,
    usuarioId: usuario.id,
    acao: "update",
    antes: { pin_hash: "[redigido]" },
    depois: { pin_hash: "[redigido]" },
  });

  revalidatePath("/configuracoes");
  return { data: true };
}

export async function temPinDefinido(): Promise<boolean> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return false;

  const admin = createAdminClient();
  const { data } = await admin.from("usuarios").select("pin_hash").eq("id", usuario.id).single();
  return Boolean(data?.pin_hash);
}
