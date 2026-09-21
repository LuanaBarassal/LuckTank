"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { limitarMfa } from "@/lib/rate-limit";

// MFA (TOTP) via Supabase Auth nativo — achado de auditoria: nenhuma camada
// de segundo fator existia em contas administrativas. Deliberadamente
// self-service e opcional pra QUALQUER usuário do escritório (não só
// administrador/dono do sistema): uma vez matriculado, o Supabase já exige
// o desafio de MFA em todo login futuro daquela conta (é assim que o modelo
// AAL do Supabase funciona — não dá pra "exigir só de alguns papéis" sem
// impedir os outros de proteger a própria conta se quiserem). O painel de
// Configurações recomenda ativar pra administrador/dono do sistema
// especificamente, mas o mecanismo em si vale pra qualquer papel.
//
// Não existe recuperação self-service se o usuário perder o autenticador
// (Supabase TOTP puro não tem códigos de backup) — nesse caso só o dono do
// sistema, via `supabase.auth.admin.mfa.deleteFactor` (fora do escopo desta
// mudança), consegue remover o fator travado. Documentado no RUNBOOK.md.

type Resultado<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export interface FatorMfa {
  id: string;
  status: "verified" | "unverified";
  criadoEm: string;
}

export async function listarFatoresMfa(): Promise<FatorMfa[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return [];

  return data.totp.map((fator) => ({
    id: fator.id,
    status: fator.status,
    criadoEm: fator.created_at,
  }));
}

export async function nivelSegurancaAtual(): Promise<{
  atual: string | null;
  proximo: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return { atual: null, proximo: null };
  return { atual: data.currentLevel, proximo: data.nextLevel };
}

// Antes de começar uma matrícula nova, limpa fatores "unverified" órfãos
// (usuário abriu o QR, não terminou, tentou de novo depois) — senão eles se
// acumulam sem limite, e o Supabase conta um teto de fatores por usuário.
export async function iniciarMatriculaMfa(): Promise<
  Resultado<{ factorId: string; qrCodeSvg: string; segredo: string }>
> {
  const supabase = await createClient();

  // `listFactors().totp` só traz fatores VERIFIED (é a garantia de tipo da
  // própria lib) — fatores unverified órfãos só aparecem em `.all`.
  const { data: listaAtual } = await supabase.auth.mfa.listFactors();
  if (listaAtual) {
    const orfaos = listaAtual.all.filter(
      (f) => f.factor_type === "totp" && f.status === "unverified"
    );
    for (const fator of orfaos) {
      await supabase.auth.mfa.unenroll({ factorId: fator.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !data || data.type !== "totp") {
    return { error: "Não foi possível iniciar a matrícula de MFA. Tente novamente." };
  }

  return {
    data: {
      factorId: data.id,
      qrCodeSvg: data.totp.qr_code,
      segredo: data.totp.secret,
    },
  };
}

export async function confirmarMatriculaMfa(
  factorId: string,
  codigo: string
): Promise<Resultado<true>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { permitido } = await limitarMfa(user.id);
  if (!permitido) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }

  if (!/^\d{6}$/.test(codigo.trim())) {
    return { error: "O código deve ter exatamente 6 dígitos." };
  }

  const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({ factorId });
  if (erroDesafio || !desafio) {
    return { error: "Não foi possível iniciar a verificação. Tente novamente." };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: desafio.id,
    code: codigo.trim(),
  });
  if (error) return { error: "Código inválido ou expirado." };

  revalidatePath("/configuracoes");
  return { data: true };
}

// Remover o PRÓPRIO fator exige AAL2 (o Supabase recusa unenroll de um
// fator verified em sessão AAL1) — coerente: se alguém roubou só a senha
// (AAL1), não consegue desligar a proteção da conta de verdade.
export async function desmatricularMfa(factorId: string): Promise<Resultado<true>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: "Não foi possível remover o MFA. Confirme o código de 6 dígitos primeiro." };

  revalidatePath("/configuracoes");
  return { data: true };
}
