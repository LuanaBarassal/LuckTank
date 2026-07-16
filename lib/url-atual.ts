import "server-only";
import { headers } from "next/headers";

// Origem (protocolo + host) usada pra montar o `redirectTo` dos convites de
// e-mail (criarEmpresa, convidarUsuarioParaEmpresa, ambos em
// admin-sistema/actions.ts) — esse link carrega o token de sessão do convite
// no fragmento da URL, então PRECISA apontar pra um domínio confiável.
//
// Prioriza `NEXT_PUBLIC_SITE_URL` (fixo, definido no deploy) em vez de
// confiar no header `Host` da requisição (achado de auditoria 2026-07-16):
// um `Host` manipulado — proxy na frente do app mal configurado, domínio
// custom apontando errado — faria o Supabase gerar o link de convite
// apontando pra fora do domínio real do LuckTank, vazando o token de quem
// clicasse. Sem a env var (dev local, preview sem configurar), cai no
// fallback antigo (lê do próprio request) — aceitável nesses ambientes
// porque quem está testando já controla a própria máquina/preview.
export async function urlBaseAtual(): Promise<string> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/$/, "");

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocolo = host.startsWith("localhost") ? "http" : "https";
  return `${protocolo}://${host}`;
}
