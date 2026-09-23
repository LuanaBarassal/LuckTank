import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import BotaoImprimir from "@/components/escritorio/botao-imprimir";
import InstrucoesMotorista from "@/components/escritorio/instrucoes-motorista";
import DadosNotaFiscal, { temDadosNotaFiscal } from "@/components/dados-nota-fiscal";
import { formatarVeiculo } from "@/lib/formatacao";

// Etiqueta do QR do veículo. Dois caminhos:
// 1) "Baixar etiqueta em PDF" (recomendado) — /api/veiculos/[id]/etiqueta
//    gera um PDF A4 de 1 página no servidor (lib/etiqueta/pdf.ts): o LuckTank
//    controla 100% do papel, sem cabeçalho/rodapé do navegador.
// 2) "Imprimir esta página" — esta própria página, que é uma folha A4 fixa
//    (210×297mm) com `@page { margin: 0 }`: sem área de margem, o Chrome não
//    tem onde injetar o cabeçalho/rodapé (data, título, URL, "1/2"); a margem
//    visual vem do padding interno da folha. Layout igual ao do PDF.
// Identificador (prefixo · placa) aparece UMA vez — o QR aqui é o PNG puro,
// sem a legenda que o SVG de download leva embaixo (era a duplicação).
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
  const veiculoLabel = formatarVeiculo(veiculo.prefixo, veiculo.placa);
  const modeloAno = [veiculo.modelo, veiculo.ano].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col items-center gap-4 py-4 print:block print:p-0">
      {/* Só nesta rota: A4 sem margem de página (ver comentário no topo). */}
      <style>{`@page { size: A4; margin: 0; }`}</style>

      <div className="flex flex-col items-center gap-2 print:hidden">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={`/api/veiculos/${veiculo.id}/etiqueta`}
            className="inline-flex min-h-touch items-center rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-navy-950 transition hover:bg-cyan-400"
          >
            Baixar etiqueta em PDF (recomendado)
          </a>
          <BotaoImprimir />
        </div>
        <p className="max-w-xl text-center text-xs text-slate-400">
          O PDF sai sempre em 1 folha A4, sem data/URL do navegador. Se preferir imprimir esta
          página e ainda aparecer data ou endereço nas bordas, desmarque &ldquo;Cabeçalhos e
          rodapés&rdquo; em &ldquo;Mais configurações&rdquo; na janela de impressão.
        </p>
      </div>

      <div className="flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white p-[14mm] text-neutral-900 shadow-xl print:shadow-none">
        <div className="text-center">
          <div className="text-[34px] font-bold leading-tight">{veiculoLabel}</div>
          {modeloAno && <div className="text-lg text-neutral-600">{modeloAno}</div>}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- vem de uma Route Handler nossa */}
        <img
          src={`/api/veiculos/${veiculo.id}/qr?formato=png`}
          alt={`QR do veículo ${veiculoLabel}`}
          className="mx-auto mt-2 h-[92mm] w-[92mm]"
        />
        <p className="text-center text-base font-bold">
          Escaneie com a câmera do celular para registrar o abastecimento
        </p>

        <hr className="my-[5mm] border-neutral-900" />

        <div
          className={
            temDadosNotaFiscal(dadosNotaFiscal)
              ? "grid grid-cols-[1fr_70mm] items-start gap-[7mm] [break-inside:avoid]"
              : "[break-inside:avoid]"
          }
        >
          <InstrucoesMotorista />
          {temDadosNotaFiscal(dadosNotaFiscal) && <DadosNotaFiscal dados={dadosNotaFiscal} />}
        </div>

        <p className="mt-auto text-center text-[11px] text-neutral-500">LuckTank — controle de combustível</p>
      </div>
    </div>
  );
}
