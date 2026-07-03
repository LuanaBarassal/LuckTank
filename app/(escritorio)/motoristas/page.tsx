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
        <h1 className="font-title text-2xl font-bold text-white">Motoristas</h1>
        {podeCadastrar && (
          <Link href="/motoristas/novo">
            <Button>Novo motorista</Button>
          </Link>
        )}
      </div>

      {!motoristas?.length && (
        <Card variant="dark">
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <span className="text-2xl">🧑‍✈️</span>
            <p className="text-sm text-slate-400">Nenhum motorista cadastrado ainda.</p>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {motoristas?.map((motorista) => (
          <Link key={motorista.id} href={`/motoristas/${motorista.id}`}>
            <Card variant="dark" className="flex items-center justify-between transition hover:border-cyan-600">
              <div>
                <div className="font-semibold text-white">{motorista.nome}</div>
                {motorista.cpf && <div className="text-sm text-slate-400">CPF: {motorista.cpf}</div>}
              </div>
              <span
                className={
                  motorista.ativo
                    ? "rounded-full bg-sucesso-500/15 px-2 py-1 text-xs font-medium text-sucesso-400"
                    : "rounded-full bg-navy-800 px-2 py-1 text-xs font-medium text-slate-400"
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
