// Opções do cookie de sessão do Supabase Auth — compartilhadas entre
// middleware.ts e lib/supabase/server.ts (os dois únicos lugares que
// ESCREVEM o cookie de sessão), pra nunca divergir entre si: se um dos
// dois usasse o default da lib (`httpOnly: false`), o próximo refresh de
// token desfaria o hardening em silêncio.
//
// Achado da auditoria de segurança 2026-07-16: o default de
// `@supabase/ssr` é `httpOnly: false` — o cookie de sessão ficava legível
// por qualquer script rodando na página. Combinado com um XSS futuro
// (hoje não encontrado, mas é defesa em profundidade), isso teria dado
// acesso à sessão inteira, não só a um dado da tela.
//
// Consequência arquitetural: um cookie `httpOnly` NUNCA pode ser
// escrito/lido via `document.cookie` — é regra do próprio navegador, não
// desta lib. Por isso login/logout/definir-senha viraram Server Actions
// (lib/auth/sessao-actions.ts) em vez de chamar o Supabase Auth direto do
// client do browser, e `lib/supabase/client.ts` foi removido (ficou sem
// nenhum uso legítimo possível depois dessa mudança).
//
// Sem `server-only`: este arquivo só tem constantes, sem segredo nenhum,
// e precisa ser importável tanto de código Node (lib/supabase/server.ts)
// quanto do Edge Runtime (middleware.ts).
export const COOKIE_OPTIONS_SESSAO = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};
