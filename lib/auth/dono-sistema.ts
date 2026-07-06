// Sem "server-only" de propósito (diferente de contexto-usuario.ts) — esta
// função é pura (só compara string com uma env var sem prefixo NEXT_PUBLIC_,
// já protegida do bundle do client pelo próprio Next.js) e precisa ser
// testável isoladamente, mesmo padrão de lib/validacao/regras.ts.

// Lista de e-mails com acesso ao painel de administração do sistema
// (app/(escritorio)/admin-sistema) — quem pode criar empresas (tenants)
// novas. Deliberadamente FORA da tabela `usuarios`/`papel`: aquele modelo é
// escopado por empresa (usuario_empresa_id()) e exige uma linha em
// `usuarios` vinculada a uma empresa_id — mas "dono do sistema" é uma coisa
// que atravessa TODAS as empresas e não deveria depender de pertencer a
// nenhuma delas. Por isso recebe o e-mail puro do Supabase Auth
// (`supabase.auth.getUser()`), não um `UsuarioAtual` — o dono pode logar e
// acessar este painel mesmo sem NUNCA ter sido convidado pra empresa
// nenhuma. Guardado como env var (nunca hardcoded no código, nunca editável
// por ninguém que só tenha acesso ao banco) — só quem controla o deploy
// consegue mudar quem tem esse acesso.
function emailsDonosSistema(): string[] {
  return (process.env.DONO_SISTEMA_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function ehDonoSistema(email: string | null | undefined): boolean {
  if (!email) return false;
  return emailsDonosSistema().includes(email.trim().toLowerCase());
}
