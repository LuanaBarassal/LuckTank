import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import GraficoBarra from "@/components/escritorio/grafico-barra";
import FiltrosAbastecimento from "@/components/escritorio/filtros-abastecimento";
import LinkExportacaoProtegida from "@/components/escritorio/link-exportacao-protegida";
import { formatarMoeda, formatarDataBr, formatarVeiculo } from "@/lib/formatacao";
import {
  parseFiltrosAbastecimento,
  resolverPeriodo,
  aplicarFiltrosQuery,
} from "@/lib/filtros/abastecimentos";
import { buscarOpcoesFiltro } from "@/lib/filtros/opcoes";
import {
  agregarGastoPorDia,
  agregarPrecoMedioPorDia,
  agregarConsumoPorVeiculo,
  agregarConsumoPorMotorista,
  agregarPostosUtilizados,
  type AbastecimentoAgregavel,
} from "@/lib/dashboard/agregacoes";

function SemDados() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
      <span className="text-2xl">📊</span>
      <p className="text-sm text-slate-400">Nenhum abastecimento no período/filtro selecionado.</p>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createClient();

  const filtros = parseFiltrosAbastecimento(searchParams);
  const periodo = resolverPeriodo(filtros);

  const { veiculos, opcoesMotorista } = await buscarOpcoesFiltro(supabase);

  const { data: abastecimentos } = await aplicarFiltrosQuery(
    supabase
      .from("abastecimentos")
      .select(
        "data_abastecimento, litros, valor_total, consumo_kml, veiculo_id, motorista_id, motorista_nome_livre, posto_nome"
      )
      .eq("status", "ativo"),
    filtros,
    periodo
  ).order("data_abastecimento", { ascending: true });

  const lista: AbastecimentoAgregavel[] = abastecimentos ?? [];

  const mapaPlacas = new Map(veiculos.map((v) => [v.id, formatarVeiculo(v.prefixo, v.placa)]));
  const mapaMotoristas = new Map(
    opcoesMotorista
      .filter((o) => o.value.startsWith("id:"))
      .map((o) => [o.value.slice(3), o.label])
  );

  const litrosPeriodo = lista.reduce((soma, a) => soma + a.litros, 0);
  const valorPeriodo = lista.reduce((soma, a) => soma + a.valor_total, 0);
  const precoMedioPeriodo = litrosPeriodo > 0 ? valorPeriodo / litrosPeriodo : 0;

  const gastoPorDia = agregarGastoPorDia(lista);
  const precoMedioPorDia = agregarPrecoMedioPorDia(lista);
  const consumoPorVeiculo = agregarConsumoPorVeiculo(lista, mapaPlacas);
  const consumoPorMotorista = agregarConsumoPorMotorista(lista, mapaMotoristas);
  const postosUtilizados = agregarPostosUtilizados(lista);

  const periodoTexto = `${formatarDataBr(periodo.de)} a ${formatarDataBr(periodo.ate)}`;

  // Mesmo filtro resolvido usado na tela — de/ate já vêm calculados aqui
  // (não recomputados no clique), então o export nunca pode divergir do que
  // está na tela no momento, mesmo que "hoje" mude entre o carregamento da
  // página e o clique no botão.
  const paramsExport = new URLSearchParams();
  paramsExport.set("de", periodo.de);
  paramsExport.set("ate", periodo.ate);
  if (filtros.veiculoId) paramsExport.set("veiculo_id", filtros.veiculoId);
  if (filtros.motoristaId) paramsExport.set("motorista_id", filtros.motoristaId);
  if (filtros.motoristaNomeLivre) paramsExport.set("motorista_nome", filtros.motoristaNomeLivre);
  const queryExport = paramsExport.toString();

  const RESUMO = [
    { label: "Litros no período", valor: `${litrosPeriodo.toFixed(1)} L` },
    { label: "Valor gasto no período", valor: formatarMoeda(valorPeriodo) },
    { label: "Nº de abastecimentos", valor: String(lista.length) },
    { label: "Preço médio/litro", valor: formatarMoeda(precoMedioPeriodo) },
  ];

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-8 font-title text-2xl font-bold text-white">Dashboard</h1>

        <Suspense fallback={<div className="h-[132px] rounded-2xl border border-navy-800 bg-navy-900" />}>
          <FiltrosAbastecimento veiculos={veiculos} opcoesMotorista={opcoesMotorista} />
        </Suspense>

        <div className="mb-5 mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Período: {periodoTexto}</p>
          <div className="flex items-center gap-2">
            <LinkExportacaoProtegida href={`/api/export?${queryExport}&formato=xlsx`}>
              Exportar Excel
            </LinkExportacaoProtegida>
            <LinkExportacaoProtegida href={`/api/export?${queryExport}&formato=pdf`}>
              Exportar PDF
            </LinkExportacaoProtegida>
            <LinkExportacaoProtegida href={`/api/export/fotos?${queryExport}`}>
              Baixar fotos (ZIP)
            </LinkExportacaoProtegida>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {RESUMO.map((item) => (
            <div key={item.label} className="rounded-2xl border border-navy-800 bg-navy-900 p-6 shadow-sm">
              <div className="text-sm text-slate-400">{item.label}</div>
              <div className="mt-2 text-2xl font-bold text-white">{item.valor}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card variant="dark">
          <CardTitle variant="dark">Gasto por dia</CardTitle>
          {gastoPorDia.length ? (
            <GraficoBarra dados={gastoPorDia} chaveX="data" chaveY="valor" corBarra="#00d4ff" />
          ) : (
            <SemDados />
          )}
        </Card>

        <Card variant="dark">
          <CardTitle variant="dark">Preço médio por litro</CardTitle>
          {precoMedioPorDia.length ? (
            <GraficoBarra dados={precoMedioPorDia} chaveX="data" chaveY="precoMedio" corBarra="#60a5fa" />
          ) : (
            <SemDados />
          )}
        </Card>

        <Card variant="dark">
          <CardTitle variant="dark">Consumo médio por ônibus (km/L)</CardTitle>
          {consumoPorVeiculo.length ? (
            <GraficoBarra dados={consumoPorVeiculo} chaveX="nome" chaveY="consumoMedio" corBarra="#fbbf24" />
          ) : (
            <SemDados />
          )}
        </Card>

        <Card variant="dark">
          <CardTitle variant="dark">Consumo médio por motorista (km/L)</CardTitle>
          {consumoPorMotorista.length ? (
            <GraficoBarra dados={consumoPorMotorista} chaveX="nome" chaveY="consumoMedio" corBarra="#34d399" />
          ) : (
            <SemDados />
          )}
        </Card>

        <Card variant="dark" className="lg:col-span-2">
          <CardTitle variant="dark">Postos mais utilizados</CardTitle>
          {postosUtilizados.length ? (
            <GraficoBarra dados={postosUtilizados} chaveX="posto" chaveY="quantidade" corBarra="#33ddff" />
          ) : (
            <SemDados />
          )}
        </Card>
      </div>

      <p className="text-xs text-slate-500">
        Mapa dos abastecimentos: pendente — depende de geolocalização, que não
        é capturada hoje (corte de escopo deliberado). Ver PROJETO.md.
      </p>
    </div>
  );
}
