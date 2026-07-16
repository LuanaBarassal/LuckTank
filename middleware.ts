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
];

function ehRotaPublica(pathname: string) {
  return PUBLICAS.some((rota) => pathname === rota || (rota !== "/" && pathname.startsWith(`${rota}/`)));
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!ehRotaPublica(request.nextUrl.pathname) && !user) {
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
