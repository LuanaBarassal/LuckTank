import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Usado só dentro de Client Components do escritório (autenticado, anon key).
// O fluxo do motorista nunca importa isto — ele fala apenas com as rotas /api/*.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
