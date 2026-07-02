import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function MotoristasPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioAtual();

  const { data: motoristas } = await supabase
    .from("motoristas")
    .select("id, nome, cpf, ativo")
    .order("criado_em", { ascending: false });

  const podeCadastrar = usuario?.papel === "gerente" || usuario?.papel === "administrador";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Motoristas</h1>
        {podeCadastrar && (
          <Link href="/motoristas/novo">
            <Button>Novo motorista</Button>
          </Link>
        )}
      </div>

      {!motoristas?.length && (
        <Card>
          <p className="text-sm text-neutral-400">Nenhum motorista cadastrado ainda.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {motoristas?.map((motorista) => (
          <Link key={motorista.id} href={`/motoristas/${motorista.id}`}>
            <Card className="flex items-center justify-between bg-slate-900 text-slate-100 hover:border-primary-600">
              <div>
                <div className="font-semibold">{motorista.nome}</div>
                {motorista.cpf && <div className="text-sm text-slate-400">CPF: {motorista.cpf}</div>}
              </div>
              <span
                className={
                  motorista.ativo
                    ? "rounded-full bg-primary-900 px-2 py-1 text-xs text-primary-300"
                    : "rounded-full bg-neutral-700 px-2 py-1 text-xs text-neutral-300"
                }
              >
                {motorista.ativo ? "Ativo" : "Inativo"}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
