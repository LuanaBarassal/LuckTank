import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import BotaoImprimir from "@/components/escritorio/botao-imprimir";
import InstrucoesMotorista from "@/components/escritorio/instrucoes-motorista";
import DadosNotaFiscal, { temDadosNotaFiscal } from "@/components/dados-nota-fiscal";
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

  // Dados da NF são da empresa (0020), não do veículo — mesma leitura via
  // sessão/RLS (empresas_select, 0010) de qualquer outra tela do escritório.
  const { data: empresa } = await supabase
    .from("empresas")
    .select("nota_fiscal_cnpj, nota_fiscal_whatsapp, nota_fiscal_email")
    .eq("id", usuario.empresa_id)
    .single();
  const dadosNotaFiscal = empresa
    ? {
        cnpj: empresa.nota_fiscal_cnpj,
        whatsapp: empresa.nota_fiscal_whatsapp,
        email: empresa.nota_fiscal_email,
      }
    : null;

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
        {temDadosNotaFiscal(dadosNotaFiscal) && <DadosNotaFiscal dados={dadosNotaFiscal} />}
      </div>
    </div>
  );
}
