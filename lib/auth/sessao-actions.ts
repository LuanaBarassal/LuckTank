"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { limitarLogin, limitarMfa, limitarRecuperacaoSenha, obterIp } from "@/lib/rate-limit";
import { urlBaseAtual } from "@/lib/url-atual";
import { validarSenha } from "./senha";

// Toda mutação de sessão do escritório (login, logout, aceitar convite,
// solicitar/concluir recuperação de senha) roda AQUI, no servidor — nunca
// mais o Client Component chamando `supabase.auth.*` direto contra o
// Supabase Auth (era assim até a auditoria de 2026-07-16). Dois motivos,
// os dois achados de maior gravidade daquela auditoria:
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
const MENSAGEM_MFA_INVALIDO = "Código inválido ou expirado.";

export interface ResultadoAcaoSessao {
  error?: string;
}

export interface ResultadoLogin extends ResultadoAcaoSessao {
  // true quando e-mail/senha estavam corretos mas a conta tem MFA
  // matriculado — a sessão já existe (AAL1), porém ainda não dá acesso às
  // rotas protegidas (ver middleware.ts). O client mostra o passo de
  // digitar o código do autenticador e chama `confirmarDesafioMfaLogin`.
  mfaRequerido?: boolean;
}

export async function login(email: string, senha: string): Promise<ResultadoLogin> {
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

  // Achado de auditoria (MFA): signInWithPassword já cria uma sessão válida
  // mesmo quando a conta tem um fator matriculado — só dá AAL1. Se o
  // próximo nível possível é AAL2, a senha sozinha não é suficiente; o
  // middleware barra o acesso às rotas protegidas até o desafio ser
  // confirmado.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return { mfaRequerido: true };
  }

  return {};
}

// Segundo passo do login quando a conta tem MFA — chamado a partir da tela
// de login depois que `login()` devolveu `mfaRequerido: true`. Usa o único
// fator TOTP verificado da conta (hoje só suportamos um fator por usuário);
// se um dia precisar de múltiplos fatores, isto precisa de um seletor.
export async function confirmarDesafioMfaLogin(codigo: string): Promise<ResultadoAcaoSessao> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { permitido } = await limitarMfa(user.id);
  if (!permitido) {
    return { error: MENSAGEM_RATE_LIMIT };
  }

  if (!/^\d{6}$/.test(codigo.trim())) {
    return { error: MENSAGEM_MFA_INVALIDO };
  }

  const { data: fatores } = await supabase.auth.mfa.listFactors();
  const fator = fatores?.totp.find((f) => f.status === "verified");
  if (!fator) return { error: "Nenhum fator de MFA encontrado nesta conta." };

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: fator.id,
    code: codigo.trim(),
  });
  if (error) return { error: MENSAGEM_MFA_INVALIDO };

  return {};
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

const MENSAGEM_RECUPERACAO_SENHA =
  "Se este e-mail estiver cadastrado, enviamos um link de recuperação.";
// Piso de tempo de resposta: a chamada real ao Supabase (quando o e-mail
// existe e o rate limit libera) inclui um round-trip de rede real; sem
// esse piso, um e-mail inexistente (resposta imediata, sem chamada nenhuma)
// responderia visivelmente mais rápido que um cadastrado — um side-channel
// de timing que denunciaria existência de conta mesmo com a MESMA
// mensagem no corpo. 700ms é folgado o bastante pra cobrir o pior caso
// observado da chamada real em dev.
const TEMPO_MINIMO_RESPOSTA_MS = 700;
const REGEX_EMAIL_BASICO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function aguardarTempoMinimo(inicio: number): Promise<void> {
  const decorrido = Date.now() - inicio;
  if (decorrido < TEMPO_MINIMO_RESPOSTA_MS) {
    await new Promise((resolve) => setTimeout(resolve, TEMPO_MINIMO_RESPOSTA_MS - decorrido));
  }
}

// "Esqueci minha senha" — usa o mecanismo NATIVO do Supabase Auth
// (`resetPasswordForEmail`), que já é anti-enumeração por design (sempre
// responde sucesso pro SDK, exista ou não o e-mail) — não inventa token
// nem tabela nova. O e-mail em si sai pelo Custom SMTP (Resend,
// `luckfrotas.com.br`) já configurado no painel do Supabase, com o
// template navy em `supabase/email-templates/redefinir-senha.html`.
//
// Contrato desta função: SEMPRE devolve a mesma mensagem, no mesmo
// formato, com o mesmo piso de tempo — não importa se o e-mail existe,
// está mal formado, ou se o rate limit acabou de estourar. É essa
// uniformidade (não o `resetPasswordForEmail` em si) que fecha a
// enumeração de verdade; qualquer desvio (mensagem diferente, retorno
// antecipado) reabre o oráculo.
export async function solicitarRecuperacaoSenha(email: string): Promise<{ mensagem: string }> {
  const inicio = Date.now();
  const emailNormalizado = typeof email === "string" ? email.trim() : "";

  if (emailNormalizado && REGEX_EMAIL_BASICO.test(emailNormalizado)) {
    const headersList = await headers();
    const ip = obterIp(headersList);

    const { permitido } = await limitarRecuperacaoSenha(ip, emailNormalizado);
    if (permitido) {
      const supabase = await createClient();
      const base = await urlBaseAtual();
      // Nunca lança: falha aqui (Resend fora do ar, e-mail inexistente,
      // erro de rede) não pode virar um caminho de resposta diferente —
      // sempre cai no mesmo `aguardarTempoMinimo` + mensagem genérica
      // abaixo, sucesso ou não.
      await supabase.auth
        .resetPasswordForEmail(emailNormalizado, { redirectTo: `${base}/definir-senha` })
        .catch(() => {});
    }
  }

  await aguardarTempoMinimo(inicio);
  return { mensagem: MENSAGEM_RECUPERACAO_SENHA };
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
    return { error: "Não foi possível definir a senha. Tente pedir um novo link." };
  }

  return {};
}
