import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAPEIS } from "@/lib/validacao/schemas";

export interface UsuarioAtual {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  papel: (typeof PAPEIS)[number];
}

function ehPapelValido(papel: string): papel is (typeof PAPEIS)[number] {
  return (PAPEIS as readonly string[]).includes(papel);
}

// Resolve o usuário do escritório logado a partir da sessão (auth.uid()).
// É a base de toda checagem de papel/empresa nas Server Actions — nunca
// aceitar empresa_id ou papel vindos do client.
//
// `papel` vem como `text` do Postgres (a validade é garantida pelo CHECK
// constraint na migration, não por um enum nativo), então o tipo gerado pelo
// Supabase é só `string` — validamos aqui em vez de confiar num cast cego.
export async function getUsuarioAtual(): Promise<UsuarioAtual | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, empresa_id, nome, email, papel")
    .eq("id", user.id)
    .single();

  if (!usuario || !ehPapelValido(usuario.papel)) return null;

  return { ...usuario, papel: usuario.papel };
}
