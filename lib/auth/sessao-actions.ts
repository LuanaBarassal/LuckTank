"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { limitarLogin, obterIp } from "@/lib/rate-limit";
import { validarSenha } from "./senha";

// Toda mutação de sessão do escritório (login, logout, aceitar convite,
// definir senha) roda AQUI, no servidor — nunca mais o Client Component
// chamando `supabase.auth.*` direto contra o Supabase Auth (era assim até
// a auditoria de 2026-07-16). Dois motivos, os dois achados de maior
// gravidade daquela auditoria:
// 1) só passando pelo nosso servidor dá pra aplicar lib/rate-limit.ts — o
//    client do browser nunca toca nosso Next.js, então nosso rate limit
//    simplesmente não existia pro login.
// 2) só o client server-side, escrevendo o cookie via `next/headers`,
//    consegue setar o cookie de sessão como `httpOnly` de verdade — um
//    cookie escrito via `document.cookie` (o que o client do browser faz)
//    NUNCA pode ser httpOnly, é restrição do próprio navegador. Ver
//    lib/supabase/cookie-options.ts.

const MENSAGEM_CREDENCIAIS_INVALIDAS = "E-mail ou senha inválidos.";
const MENSAGEM_RATE_LIMIT = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
const MENSAGEM_LINK_INVALIDO = "Link inválido ou expirado.";

export interface ResultadoAcaoSessao {
  error?: string;
}

export async function login(email: string, senha: string): Promise<ResultadoAcaoSessao> {
  const emailNormalizado = typeof email === "string" ? email.trim() : "";
  if (!emailNormalizado || typeof senha !== "string" || !senha) {
    return { error: MENSAGEM_CREDENCIAIS_INVALIDAS };
  }

  const headersList = await headers();
  const ip = obterIp(headersList);

  // Conta a tentativa ANTES de chamar o Supabase — barra mesmo que a
  // senha estivesse certa (padrão já usado em lib/auth/pin.ts: estourar o
  // limite nunca deve dar sinal nenhum diferente de "tenta de novo mais
  // tarde", pra não virar um oráculo de "essa combinação era válida").
  const { permitido } = await limitarLogin(ip, emailNormalizado);
  if (!permitido) {
    return { error: MENSAGEM_RATE_LIMIT };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: emailNormalizado,
    password: senha,
  });

  // Mensagem sempre genérica — nunca diferencia "e-mail não existe" de
  // "senha errada" (achado da auditoria: isso vazaria quais e-mails são
  // clientes do LuckTank).
  if (error) {
    return { error: MENSAGEM_CREDENCIAIS_INVALIDAS };
  }

  return {};
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

// Recebe os tokens que o Supabase manda no HASH da URL do link de
// convite/recuperação (só o JavaScript do browser consegue ler isso — por
// isso ainda é o client que lê `window.location.hash`, só que agora manda
// os tokens pra esta Server Action em vez de chamar `setSession` ele
// mesmo). O POST da Server Action viaja em HTTPS, não na URL/log nenhum.
export async function estabelecerSessaoConvite(
  accessToken: string,
  refreshToken: string
): Promise<ResultadoAcaoSessao> {
  if (!accessToken || !refreshToken) {
    return { error: MENSAGEM_LINK_INVALIDO };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) return { error: MENSAGEM_LINK_INVALIDO };
  return {};
}

// Usado quando a página é recarregada sem hash na URL (o hash já foi
// consumido e limpo numa visita anterior) — só confere se já existe uma
// sessão válida estabelecida por `estabelecerSessaoConvite`.
export async function sessaoAtivaConvite(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function definirSenha(
  novaSenha: string,
  confirmarSenha: string
): Promise<ResultadoAcaoSessao> {
  const validacao = validarSenha(novaSenha);
  if (!validacao.valida) {
    return { error: validacao.erro ?? "Senha inválida." };
  }
  if (novaSenha !== confirmarSenha) {
    return { error: "As senhas não coincidem." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sessão expirada. Peça um novo link." };
  }

  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) {
    return { error: "Não foi possível definir a senha. Tente pedir um novo convite." };
  }

  return {};
}
