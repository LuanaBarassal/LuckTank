import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ROTULO_TIPO_COMBUSTIVEL } from "@/lib/validacao/schemas";
import { formatarVeiculo } from "@/lib/formatacao";

// Cadastro de veículo novo saiu daqui de propósito: só o LuckTank adiciona
// veículo a uma empresa agora (ver app/(escritorio)/admin-sistema — mesmo
// motivo de "Convidar usuário" ter saído desta empresa também). Edição de
// veículo já cadastrado continua liberada pra gerente/administrador, sem
// mudança nenhuma (ver onibus/[id]/page.tsx).
export default async function OnibusPage() {
  const supabase = await createClient();

  const { data: veiculos } = await supabase
    .from("veiculos")
    .select("id, placa, prefixo, modelo, ano, tipo_combustivel, km_atual, ativo")
    .order("criado_em", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 font-title text-2xl font-bold text-white">Ônibus</h1>

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
                <div className="font-semibold text-white">
                  {formatarVeiculo(veiculo.prefixo, veiculo.placa)}
                </div>
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
