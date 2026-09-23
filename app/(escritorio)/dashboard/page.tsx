import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { Card, CardTitle } from "@/components/ui/card";
import GraficoBarra from "@/components/escritorio/grafico-barra";
import FiltrosAbastecimento from "@/components/escritorio/filtros-abastecimento";
import LinkExportacaoProtegida from "@/components/escritorio/link-exportacao-protegida";
import BotaoAnexarNotaFiscal from "@/components/escritorio/botao-anexar-nota-fiscal";
import { formatarMoeda, formatarDataBr, formatarVeiculo } from "@/lib/formatacao";
import {
  parseFiltrosAbastecimento,
  resolverPeriodo,
  aplicarFiltrosQuery,
} from "@/lib/filtros/abastecimentos";
import { buscarOpcoesFiltro } from "@/lib/filtros/opcoes";
import { buscarTodasLinhas } from "@/lib/supabase/paginar";
import {
  agregarGastoPorDia,
  agregarPrecoMedioPorDia,
  agregarConsumoPorVeiculo,
  agregarConsumoPorMotorista,
  agregarPostosUtilizados,
  type AbastecimentoAgregavel,
} from "@/lib/dashboard/agregacoes";

type AbastecimentoDashboard = AbastecimentoAgregavel & { tem_nota_fiscal: boolean | null };

// Lista de "quais faltam" no dashboard — o total vem da lista completa do
// período (acima); aqui só as mais recentes pra ação rápida. Pra ver todas,
// o filtro "Só nota fiscal pendente" na aba de cada veículo.
const LIMITE_NOTAS_PENDENTES = 20;

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

  // Paginado (não um único `await` direto) — ver lib/supabase/paginar.ts:
  // sem isso, o teto default do PostgREST (1000 linhas) truncaria o
  // dashboard em silêncio pra uma empresa com histórico grande.
  const lista: AbastecimentoDashboard[] = await buscarTodasLinhas((inicio, fim) =>
    aplicarFiltrosQuery(
      supabase
        .from("abastecimentos")
        .select(
          "data_abastecimento, litros, valor_total, consumo_kml, veiculo_id, motorista_id, motorista_nome_livre, posto_nome, tem_nota_fiscal"
        )
        .eq("status", "ativo"),
      filtros,
      periodo
    )
      .order("data_abastecimento", { ascending: true })
      .range(inicio, fim)
  );

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

  const usuario = await getUsuarioAtual();
  const podeAnexarNota = usuario?.papel === "gerente" || usuario?.papel === "administrador";
  const totalNotasPendentes = lista.filter((a) => a.tem_nota_fiscal === false).length;
  const { data: notasPendentes } = totalNotasPendentes
    ? await aplicarFiltrosQuery(
        supabase
          .from("abastecimentos")
          .select("id, data_abastecimento, valor_total, litros, veiculo_id, motorista_id, motorista_nome_livre")
          .eq("status", "ativo")
          .eq("tem_nota_fiscal", false),
        filtros,
        periodo
      )
        .order("data_abastecimento", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(LIMITE_NOTAS_PENDENTES)
    : { data: [] };

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
  if (filtros.notaPendente) paramsExport.set("nota", "pendente");
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

      {totalNotasPendentes > 0 && (
        <Card variant="dark" className="border-atencao-500/40">
          <CardTitle variant="dark">
            Nota fiscal pendente
            <span className="ml-2 rounded-full bg-atencao-500/15 px-2 py-0.5 text-xs font-semibold text-atencao-400">
              {totalNotasPendentes} no período
            </span>
          </CardTitle>
          <p className="-mt-2 mb-4 text-xs text-slate-500">
            Abastecimentos registrados sem a nota fiscal eletrônica.
            {podeAnexarNota
              ? " Clique em “Anexar NF” pra enviar a foto ou o PDF da nota."
              : " Gerente ou administrador podem anexar a nota."}
            {totalNotasPendentes > LIMITE_NOTAS_PENDENTES &&
              ` Mostrando as ${LIMITE_NOTAS_PENDENTES} mais recentes — use o filtro “Só nota fiscal pendente” na aba do veículo pra ver todas.`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-navy-800 text-slate-400">
                  <th className="py-3 pr-5 font-medium">Data</th>
                  <th className="py-3 pr-5 font-medium">Veículo</th>
                  <th className="py-3 pr-5 font-medium">Litros</th>
                  <th className="py-3 pr-5 font-medium">Total</th>
                  <th className="py-3 pr-5 font-medium">Motorista</th>
                  {podeAnexarNota && <th className="py-3 pr-5 font-medium">Nota</th>}
                </tr>
              </thead>
              <tbody>
                {(notasPendentes ?? []).map((a) => (
                  <tr key={a.id} className="border-b border-navy-800/50 text-slate-200">
                    <td className="py-3 pr-5">{formatarDataBr(a.data_abastecimento)}</td>
                    <td className="py-3 pr-5">
                      <Link
                        href={`/onibus/${a.veiculo_id}?nota=pendente&de=${periodo.de}&ate=${periodo.ate}`}
                        className="font-medium text-cyan-400 underline-offset-2 hover:underline"
                      >
                        {mapaPlacas.get(a.veiculo_id) ?? "—"}
                      </Link>
                    </td>
                    <td className="py-3 pr-5">{a.litros} L</td>
                    <td className="py-3 pr-5">{formatarMoeda(a.valor_total)}</td>
                    <td className="py-3 pr-5">
                      {a.motorista_nome_livre ??
                        (a.motorista_id ? mapaMotoristas.get(a.motorista_id) : null) ??
                        "—"}
                    </td>
                    {podeAnexarNota && (
                      <td className="py-2 pr-5">
                        <BotaoAnexarNotaFiscal abastecimentoId={a.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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
          <CardTitle variant="dark">Consumo médio por veículo (km/L)</CardTitle>
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
