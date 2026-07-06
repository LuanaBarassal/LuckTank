import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import BotaoImprimir from "@/components/escritorio/botao-imprimir";
import InstrucoesMotorista from "@/components/escritorio/instrucoes-motorista";
import { formatarVeiculo } from "@/lib/formatacao";

export default async function EtiquetaVeiculoPage({ params }: { params: { id: string } }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const { data: veiculo } = await supabase
    .from("veiculos")
    .select("id, placa, prefixo, modelo, ano")
    .eq("id", params.id)
    .single();

  if (!veiculo) notFound();

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <BotaoImprimir />
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-300 bg-white p-8 text-neutral-900 print:border-0 print:shadow-none">
        <InstrucoesMotorista />
        {/* eslint-disable-next-line @next/next/no-img-element -- vem de uma Route Handler nossa */}
        <img
          src={`/api/veiculos/${veiculo.id}/qr?formato=svg`}
          alt={`QR do veículo ${formatarVeiculo(veiculo.prefixo, veiculo.placa)}`}
          className="w-64"
        />
        <div className="text-center">
          <div className="text-3xl font-bold">{formatarVeiculo(veiculo.prefixo, veiculo.placa)}</div>
          {(veiculo.modelo || veiculo.ano) && (
            <div className="text-lg text-neutral-600">
              {[veiculo.modelo, veiculo.ano].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
