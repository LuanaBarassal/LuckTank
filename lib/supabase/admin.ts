import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service role — ignora RLS. Só pode ser importado dentro de app/api/**.
// É este client que grava abastecimentos vindos do fluxo do motorista (sem sessão/RLS),
// depois de rodar a validação de negócio no próprio route handler.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
