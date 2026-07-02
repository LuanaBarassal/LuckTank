import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { Card, CardTitle } from "@/components/ui/card";
import ConvidarUsuarioForm from "@/components/escritorio/convidar-usuario-form";

export default async function ConfiguracoesPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel")
    .order("nome");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>

      <Card className="max-w-2xl bg-slate-900 text-slate-100">
        <CardTitle>Usuários do escritório</CardTitle>
        <div className="flex flex-col gap-2 text-sm">
          {usuarios?.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between border-b border-slate-800 py-2 last:border-0"
            >
              <div>
                <div className="font-medium">{u.nome}</div>
                <div className="text-slate-400">{u.email}</div>
              </div>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs">{u.papel}</span>
            </div>
          ))}
        </div>
      </Card>

      {usuario.papel === "administrador" ? (
        <Card className="max-w-md bg-slate-900 text-slate-100">
          <CardTitle>Convidar usuário</CardTitle>
          <ConvidarUsuarioForm />
        </Card>
      ) : (
        <p className="text-sm text-neutral-400">
          Só administradores podem convidar novos usuários.
        </p>
      )}
    </div>
  );
}
