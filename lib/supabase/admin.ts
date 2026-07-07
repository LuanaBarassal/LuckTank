import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service role — ignora RLS. Só pode ser importado em código que roda
// exclusivamente no servidor: Route Handlers (app/api/**) e Server Actions
// (actions.ts) — nunca em Client Component. É este client que grava
// abastecimentos vindos do fluxo do motorista (sem sessão/RLS), depois de
// rodar a validação de negócio no próprio route handler; também usado por
// Server Actions que precisam de uma etapa fora do alcance da RLS do usuário
// (ex.: admin-sistema/actions.ts, criando empresa + convidando o primeiro
// administrador).
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
