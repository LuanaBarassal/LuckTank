import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas públicas: "/" (tela de status), fluxo do motorista (QR, sem login) e a
// própria página de login. Tudo o mais é escritório e exige sessão autenticada
// (RLS resolve empresa_id).
const PUBLICAS = [
  "/",
  "/login",
  "/r",
  "/api/ocr",
  "/api/gemini",
  "/api/abastecimentos",
  "/api/sync",
  "/api/luckfrotas",
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
