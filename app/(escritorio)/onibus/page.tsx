import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROTULO_TIPO_COMBUSTIVEL } from "@/lib/validacao/schemas";

export default async function OnibusPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioAtual();

  const { data: veiculos } = await supabase
    .from("veiculos")
    .select("id, placa, modelo, ano, tipo_combustivel, km_atual, ativo")
    .order("criado_em", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-title text-2xl font-bold text-white">Ônibus</h1>
        {usuario?.papel === "administrador" && (
          <Link href="/onibus/novo">
            <Button>Novo veículo</Button>
          </Link>
        )}
      </div>

      {!veiculos?.length && (
        <Card variant="dark">
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <span className="text-2xl">🚌</span>
            <p className="text-sm text-slate-400">Nenhum veículo cadastrado ainda.</p>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {veiculos?.map((veiculo) => (
          <Link key={veiculo.id} href={`/onibus/${veiculo.id}`}>
            <Card variant="dark" className="flex items-center justify-between transition hover:border-cyan-600">
              <div>
                <div className="font-semibold text-white">{veiculo.placa}</div>
                <div className="text-sm text-slate-400">
                  {[veiculo.modelo, veiculo.ano, veiculo.tipo_combustivel && ROTULO_TIPO_COMBUSTIVEL[veiculo.tipo_combustivel as keyof typeof ROTULO_TIPO_COMBUSTIVEL]]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span>{veiculo.km_atual != null ? `${veiculo.km_atual} km` : "—"}</span>
                <span
                  className={
                    veiculo.ativo
                      ? "rounded-full bg-sucesso-500/15 px-2 py-1 text-xs font-medium text-sucesso-400"
                      : "rounded-full bg-navy-800 px-2 py-1 text-xs font-medium text-slate-400"
                  }
                >
                  {veiculo.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
