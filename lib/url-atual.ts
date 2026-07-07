import "server-only";
import { headers } from "next/headers";

// Origem (protocolo + host) da requisição atual — usado pra montar o
// `redirectTo` dos convites de e-mail (criarEmpresa, convidarUsuarioParaEmpresa,
// ambos em admin-sistema/actions.ts) sem precisar de env var: funciona em dev
// (localhost:3000), preview da Vercel e produção automaticamente, porque lê
// do próprio request.
export async function urlBaseAtual(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocolo = host.startsWith("localhost") ? "http" : "https";
  return `${protocolo}://${host}`;
}
