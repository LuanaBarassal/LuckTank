import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_OPTIONS_SESSAO } from "@/lib/supabase/cookie-options";

// Rotas públicas: "/" (redirect pro login), fluxo do motorista (QR, sem
// login), a própria página de login, /esqueci-senha (formulário que pede
// o e-mail — quem ainda não tem sessão precisa acessar isso), e
// /definir-senha (link de convite OU de recuperação de senha — chega com
// os tokens só no HASH da URL, que nunca vai pro servidor; nesse primeiro
// carregamento o middleware sempre veria "sem sessão", então essa rota
// PRECISA ser pública, senão o middleware redireciona pro /login antes do
// client conseguir ler o hash e completar o login). Tudo o mais é
// escritório e exige sessão autenticada (RLS resolve empresa_id).
const PUBLICAS = [
  "/",
  "/login",
  "/esqueci-senha",
  "/definir-senha",
  "/r",
  "/privacidade",
  "/termos",
  "/api/ocr",
  "/api/gemini",
  "/api/abastecimentos",
  "/api/cron",
];

function ehRotaPublica(pathname: string) {
  return PUBLICAS.some((rota) => pathname === rota || (rota !== "/" && pathname.startsWith(`${rota}/`)));
}

// Incidente 2026-09-07: Supabase lento/instável travou a chamada de rede
// abaixo (sem timeout, e este middleware roda em ~toda rota) até o Vercel
// matar a função por inteiro (504 MIDDLEWARE_INVOCATION_TIMEOUT) — um
// serviço externo derrubando o site inteiro. `symbol` como sentinela
// distingue "expirou" de qualquer valor real (incluindo `null`/`undefined`)
// que a promise resolva.
const EXPIROU = Symbol("timeout");

async function comTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof EXPIROU> {
  return Promise.race([
    promise,
    new Promise<typeof EXPIROU>((resolve) => setTimeout(() => resolve(EXPIROU), ms)),
  ]);
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: COOKIE_OPTIONS_SESSAO,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Timeout curto + fail-open: o Supabase é uma dependência externa, e uma
  // lentidão/instabilidade dele nunca pode travar o middleware — que roda em
  // ~toda rota — a ponto do Vercel matar a função (504
  // MIDDLEWARE_INVOCATION_TIMEOUT) e derrubar o site inteiro. Se a checagem
  // não voltar a tempo, deixa a requisição passar: quem não tem sessão de
  // verdade esbarra no RLS ao tentar ler dados de qualquer forma, então isso
  // não abre acesso real — só evita que uma instabilidade externa vire
  // indisponibilidade total do site.
  const resultadoAuth = await comTimeout(supabase.auth.getUser(), 3000);
  if (resultadoAuth === EXPIROU) {
    console.error("[middleware] timeout ao verificar sessao no Supabase - liberando requisicao (fail-open)");
    return response;
  }
  const {
    data: { user },
  } = resultadoAuth;

  // Achado de auditoria (MFA): `signInWithPassword` já deixa uma sessão
  // válida (AAL1) mesmo quando a conta tem um fator matriculado — sem esta
  // checagem, quem tivesse a senha (roubada ou reaproveitada) entraria nas
  // rotas protegidas sem nunca ser desafiado pelo segundo fator. Só barra
  // quando o PRÓXIMO nível possível é AAL2 e o ATUAL ainda não chegou lá —
  // contas sem MFA matriculado (`nextLevel` fica em "aal1") continuam
  // passando normalmente, sem custo extra de latência perceptível
  // (`getAuthenticatorAssuranceLevel` sem JWT só lê o token já em memória).
  let precisaAutenticar = !user;
  if (user && !ehRotaPublica(request.nextUrl.pathname)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      precisaAutenticar = true;
    }
  }

  if (!ehRotaPublica(request.nextUrl.pathname) && precisaAutenticar) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // roda em tudo, exceto assets estáticos, o manifest e o service worker do PWA
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
