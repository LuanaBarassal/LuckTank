import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import VeiculoForm from "@/components/escritorio/veiculo-form";
import VeiculoAtivoToggle from "@/components/escritorio/veiculo-ativo-toggle";
import FiltrosAbastecimento from "@/components/escritorio/filtros-abastecimento";
import FotoComprovante from "@/components/escritorio/foto-comprovante";
import { Card, CardTitle } from "@/components/ui/card";
import { formatarMoeda, formatarDataBr, formatarVeiculo } from "@/lib/formatacao";
import {
  calcularEstatisticasVeiculo,
  compararConsumoComReferencia,
  type AbastecimentoParaEstatistica,
  type ComparativoConsumo,
} from "@/lib/onibus/estatisticas";
import {
  parseFiltrosAbastecimento,
  resolverPeriodo,
  aplicarFiltrosQuery,
} from "@/lib/filtros/abastecimentos";
import { buscarOpcoesFiltro } from "@/lib/filtros/opcoes";
import { cn } from "@/lib/utils";

const LIMITE_TABELA = 50;

type NivelAlerta = "info" | "atencao" | "critico";
const PRIORIDADE_NIVEL: Record<NivelAlerta, number> = { info: 0, atencao: 1, critico: 2 };

export default async function VeiculoDetalhePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const { data: veiculo } = await supabase
    .from("veiculos")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!veiculo) notFound();

  // Veículo já vem fixo pela rota — o filtro de veículo da barra nem
  // aparece aqui (só data + motorista); a lista de motoristas ainda cobre a
  // empresa inteira, não só quem já abasteceu este veículo específico.
  const filtros = { ...parseFiltrosAbastecimento(searchParams), veiculoId: veiculo.id };
  const periodo = resolverPeriodo(filtros);
  const { opcoesMotorista } = await buscarOpcoesFiltro(supabase);

  // Estatísticas são sobre o período filtrado (não mais "todo o histórico" —
  // ver Bloco 1 de filtros no PROJETO.md), mas ainda sem `limit`: a conta de
  // soma/soma precisa de todos os registros do período, não só os que
  // aparecem na página da tabela.
  const { data: historicoFiltrado } = await aplicarFiltrosQuery(
    supabase
      .from("abastecimentos")
      .select("data_abastecimento, km_rodado, litros, valor_total")
      .eq("status", "ativo"),
    filtros,
    periodo
  );

  const estatisticas = calcularEstatisticasVeiculo(
    (historicoFiltrado ?? []) as AbastecimentoParaEstatistica[]
  );

  const { data: abastecimentos } = await aplicarFiltrosQuery(
    supabase
      .from("abastecimentos")
      .select(
        "id, data_abastecimento, km_atual, km_rodado, litros, valor_total, consumo_kml, motorista_id, motorista_nome_livre"
      )
      .eq("status", "ativo"),
    filtros,
    periodo
  )
    .order("criado_em", { ascending: false })
    .limit(LIMITE_TABELA);

  const mapaMotoristas = new Map(
    opcoesMotorista
      .filter((o) => o.value.startsWith("id:"))
      .map((o) => [o.value.slice(3), o.label])
  );

  // Nível mais alto de alerta por abastecimento — um registro pode ter mais
  // de um alerta (ex.: capacidade do tanque + consumo fora da faixa juntos,
  // ver lib/validacao/regras.ts); a linha na tabela usa o mais grave dos dois.
  const idsAbastecimentos = (abastecimentos ?? []).map((a) => a.id);
  const { data: alertasDosAbastecimentos } = idsAbastecimentos.length
    ? await supabase
        .from("alertas")
        .select("entidade_id, nivel")
        .eq("entidade_tipo", "abastecimento")
        .in("entidade_id", idsAbastecimentos)
    : { data: [] as { entidade_id: string; nivel: string }[] };

  const mapaNivelAlerta = new Map<string, NivelAlerta>();
  for (const alerta of alertasDosAbastecimentos ?? []) {
    const nivel = alerta.nivel as NivelAlerta;
    const atual = mapaNivelAlerta.get(alerta.entidade_id);
    if (!atual || PRIORIDADE_NIVEL[nivel] > PRIORIDADE_NIVEL[atual]) {
      mapaNivelAlerta.set(alerta.entidade_id, nivel);
    }
  }

  // Uma foto por abastecimento na prática (o wizard só permite uma) — se um
  // dia existir mais de uma linha em `midias` pro mesmo abastecimento, fica
  // valendo a mais recente (a query já não teria ordem garantida sem isso).
  const { data: midiasDosAbastecimentos } = idsAbastecimentos.length
    ? await supabase
        .from("midias")
        .select("id, entidade_id, criado_em")
        .eq("entidade_tipo", "abastecimento")
        .eq("tipo", "foto_comprovante")
        .in("entidade_id", idsAbastecimentos)
        .order("criado_em", { ascending: false })
    : { data: [] as { id: string; entidade_id: string; criado_em: string }[] };

  const mapaMidiaId = new Map<string, string>();
  for (const midia of midiasDosAbastecimentos ?? []) {
    if (!mapaMidiaId.has(midia.entidade_id)) mapaMidiaId.set(midia.entidade_id, midia.id);
  }

  const podeEditar = usuario.papel === "gerente" || usuario.papel === "administrador";
  const periodoTexto = `${formatarDataBr(periodo.de)} a ${formatarDataBr(periodo.ate)}`;

  // Mesmo filtro resolvido usado na tela (período + motorista; veículo já
  // vem fixo por esta rota) — o export nunca pode divergir do que está na
  // tela, mesmo que "hoje" mude entre o carregamento da página e o clique.
  const paramsExport = new URLSearchParams();
  paramsExport.set("de", periodo.de);
  paramsExport.set("ate", periodo.ate);
  paramsExport.set("veiculo_id", veiculo.id);
  if (filtros.motoristaId) paramsExport.set("motorista_id", filtros.motoristaId);
  if (filtros.motoristaNomeLivre) paramsExport.set("motorista_nome", filtros.motoristaNomeLivre);
  const queryExport = paramsExport.toString();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-title text-2xl font-bold text-white">
          {formatarVeiculo(veiculo.prefixo, veiculo.placa)}
        </h1>
        {podeEditar && <VeiculoAtivoToggle id={veiculo.id} ativo={veiculo.ativo} />}
      </div>

      <Suspense fallback={<div className="h-[92px] rounded-2xl border border-navy-800 bg-navy-900" />}>
        <FiltrosAbastecimento opcoesMotorista={opcoesMotorista} />
      </Suspense>

      <div className="-mt-4 flex justify-end gap-2">
        <a
          href={`/api/export?${queryExport}&formato=xlsx`}
          className="inline-flex min-h-touch items-center justify-center rounded-xl border-2 border-cyan-600 px-4 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
        >
          Exportar Excel
        </a>
        <a
          href={`/api/export?${queryExport}&formato=pdf`}
          className="inline-flex min-h-touch items-center justify-center rounded-xl border-2 border-cyan-600 px-4 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
        >
          Exportar PDF
        </a>
      </div>

      <ResumoEstatisticas
        estatisticas={estatisticas}
        periodoTexto={periodoTexto}
        comparativoConsumo={compararConsumoComReferencia(
          estatisticas.consumoMedioKml,
          veiculo.consumo_referencia_kml
        )}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <Card variant="dark">
          <CardTitle variant="dark">Dados do veículo</CardTitle>
          {podeEditar ? (
            <VeiculoForm empresaId={usuario.empresa_id} veiculo={veiculo} />
          ) : (
            <p className="text-sm text-slate-400">
              Você não tem permissão para editar este veículo.
            </p>
          )}
        </Card>

        <Card variant="dark">
          <CardTitle variant="dark">QR do veículo</CardTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- vem de uma Route Handler nossa, não de storage otimizável pelo next/image */}
          <img
            src={`/api/veiculos/${veiculo.id}/qr?formato=svg`}
            alt={`QR do veículo ${formatarVeiculo(veiculo.prefixo, veiculo.placa)}`}
            className="mx-auto w-48 rounded-lg bg-white p-2"
          />
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <a
              className="font-medium text-cyan-400 underline-offset-2 hover:underline"
              href={`/api/veiculos/${veiculo.id}/qr?formato=svg&baixar=1`}
            >
              Baixar SVG
            </a>
            <a
              className="font-medium text-cyan-400 underline-offset-2 hover:underline"
              href={`/api/veiculos/${veiculo.id}/qr?formato=png&baixar=1`}
            >
              Baixar PNG
            </a>
            <Link
              className="font-medium text-cyan-400 underline-offset-2 hover:underline"
              href={`/onibus/${veiculo.id}/etiqueta`}
            >
              Ver etiqueta para impressão
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Token permanente: <code>{veiculo.qr_token}</code>
          </p>
        </Card>
      </div>

      <Card variant="dark">
        <CardTitle variant="dark">
          Histórico de abastecimentos
          {(abastecimentos?.length ?? 0) === LIMITE_TABELA && (
            <span className="ml-2 text-xs font-normal text-slate-500">
              (últimos {LIMITE_TABELA} do período filtrado — as médias acima consideram todo o período, não só estas linhas)
            </span>
          )}
        </CardTitle>
        {!abastecimentos?.length ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <span className="text-2xl">⛽</span>
            <p className="text-sm text-slate-400">Nenhum abastecimento no período/filtro selecionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-navy-800 text-slate-400">
                  <th className="py-3 pr-5 font-medium">Foto</th>
                  <th className="py-3 pr-5 font-medium">Data</th>
                  <th className="py-3 pr-5 font-medium">KM atual</th>
                  <th className="py-3 pr-5 font-medium">KM rodado</th>
                  <th className="py-3 pr-5 font-medium">Litros</th>
                  <th className="py-3 pr-5 font-medium">R$/litro</th>
                  <th className="py-3 pr-5 font-medium">Total</th>
                  <th className="py-3 pr-5 font-medium">Consumo (km/L)</th>
                  <th className="py-3 pr-5 font-medium">Motorista</th>
                </tr>
              </thead>
              <tbody>
                {abastecimentos.map((a) => {
                  const nivel = mapaNivelAlerta.get(a.id);
                  const valorPorLitro = a.litros > 0 ? a.valor_total / a.litros : null;
                  const midiaId = mapaMidiaId.get(a.id);
                  return (
                    <tr
                      key={a.id}
                      className={cn(
                        "border-b border-navy-800/50 text-slate-200",
                        nivel === "critico" && "bg-critico-500/5",
                        nivel === "atencao" && "bg-atencao-500/5"
                      )}
                    >
                      <td className="py-3.5 pr-5">
                        {midiaId ? <FotoComprovante midiaId={midiaId} /> : <span className="text-slate-600">—</span>}
                      </td>
                      <td
                        className={cn(
                          "py-3.5 pr-5",
                          nivel === "critico" && "border-l-4 border-l-critico-500 pl-2",
                          nivel === "atencao" && "border-l-4 border-l-atencao-500 pl-2"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {formatarDataBr(a.data_abastecimento)}
                          {nivel && (
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                                nivel === "critico" && "bg-critico-500 text-white",
                                nivel === "atencao" && "bg-atencao-500/15 text-atencao-400"
                              )}
                            >
                              {nivel === "critico" ? "Crítico" : "Atenção"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 pr-5">{a.km_atual}</td>
                      <td className="py-3.5 pr-5">{a.km_rodado != null ? `${a.km_rodado} km` : "—"}</td>
                      <td className="py-3.5 pr-5">{a.litros} L</td>
                      <td className="py-3.5 pr-5">
                        {valorPorLitro != null ? formatarMoeda(valorPorLitro) : "—"}
                      </td>
                      <td className="py-3.5 pr-5">{formatarMoeda(a.valor_total)}</td>
                      <td className="py-3.5 pr-5">
                        {a.consumo_kml != null ? Number(a.consumo_kml).toFixed(2) : "—"}
                      </td>
                      <td className="py-3.5 pr-5">
                        {a.motorista_nome_livre ?? (a.motorista_id ? mapaMotoristas.get(a.motorista_id) : null) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-navy-700 font-semibold text-white">
                  <td className="py-3.5 pr-5" colSpan={3}>
                    Total no período filtrado
                  </td>
                  <td className="py-3.5 pr-5">{estatisticas.totalKmRodado} km</td>
                  <td className="py-3.5 pr-5">{estatisticas.totalLitros.toFixed(1)} L</td>
                  <td className="py-3.5 pr-5" />
                  <td className="py-3.5 pr-5">{formatarMoeda(estatisticas.totalValorGasto)}</td>
                  <td className="py-3.5 pr-5" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ResumoEstatisticas({
  estatisticas,
  periodoTexto,
  comparativoConsumo,
}: {
  estatisticas: ReturnType<typeof calcularEstatisticasVeiculo>;
  periodoTexto: string;
  comparativoConsumo: ComparativoConsumo;
}) {
  if (estatisticas.totalAbastecimentos === 0) {
    return (
      <Card variant="dark">
        <div className="flex flex-col items-center gap-1 py-4 text-center">
          <span className="text-2xl">📊</span>
          <p className="text-sm text-slate-400">Nenhum abastecimento no período/filtro selecionado.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <CardEstatistica
          label="Consumo médio no período filtrado"
          valor={estatisticas.consumoMedioKml != null ? `${estatisticas.consumoMedioKml.toFixed(2)} km/L` : null}
          rodape={
            estatisticas.abastecimentosComKmValido > 0
              ? `média sobre ${estatisticas.abastecimentosComKmValido} registro(s) válido(s)`
              : undefined
          }
        />
        <CardEstatistica
          label="Custo médio por km no período filtrado"
          valor={estatisticas.custoMedioPorKm != null ? formatarMoeda(estatisticas.custoMedioPorKm) : null}
          rodape={
            estatisticas.abastecimentosComKmValido > 0
              ? `média sobre ${estatisticas.abastecimentosComKmValido} registro(s) válido(s)`
              : undefined
          }
        />
        <CardEstatistica
          label="Gasto médio por abastecimento no período filtrado"
          valor={formatarMoeda(estatisticas.gastoMedioPorAbastecimento ?? 0)}
          rodape={`média sobre ${estatisticas.totalAbastecimentos} registro(s)`}
        />
        <CardComparativoConsumo comparativo={comparativoConsumo} />
      </div>
      <p className="text-xs text-slate-500">
        Período filtrado: {periodoTexto} · {estatisticas.totalAbastecimentos} abastecimento(s) no período.
        {estatisticas.abastecimentosComKmValido < estatisticas.totalAbastecimentos && (
          <>
            {" "}
            ({estatisticas.totalAbastecimentos - estatisticas.abastecimentosComKmValido} sem KM rodado válido —
            não entram no consumo médio nem no custo por km.)
          </>
        )}
      </p>
    </div>
  );
}

// Rótulo/cor por status — "pior" salta aos olhos (mesmo padrão semântico do
// painel de alertas: crítico chama mais atenção que os outros); "sem
// referência" é um convite pra cadastrar, não um erro.
const ROTULO_STATUS_COMPARATIVO: Record<ComparativoConsumo["status"], string> = {
  sem_referencia: "Sem referência cadastrada",
  sem_dado_real: "Sem consumo real no período",
  pior_que_referencia: "Pior que a referência",
  dentro_do_esperado: "Dentro do esperado",
  melhor_que_referencia: "Melhor que a referência",
};

function CardComparativoConsumo({ comparativo }: { comparativo: ComparativoConsumo }) {
  const { status, referenciaKml, realKml, desvioPercentual } = comparativo;

  if (status === "sem_referencia") {
    return (
      <div className="rounded-2xl border border-dashed border-navy-700 bg-navy-900 p-6">
        <div className="text-sm text-slate-400">Consumo real x referência</div>
        <div className="mt-2 text-sm text-slate-400">
          Cadastre o consumo de referência (km/L) do modelo em &ldquo;Dados do veículo&rdquo; pra
          comparar com o consumo real medido.
        </div>
      </div>
    );
  }

  const badge =
    status === "pior_que_referencia"
      ? "bg-critico-500 text-white"
      : status === "melhor_que_referencia"
        ? "bg-sucesso-500/15 text-sucesso-400"
        : "bg-atencao-500/15 text-atencao-400";

  return (
    <div
      className={cn(
        "rounded-2xl border p-6",
        status === "pior_que_referencia"
          ? "border-critico-500/40 bg-critico-500/5"
          : "border-navy-800 bg-navy-900"
      )}
    >
      <div className="text-sm text-slate-400">Consumo real x referência</div>
      <div className="mt-2 text-2xl font-bold text-white">
        {realKml != null ? `${realKml.toFixed(2)} km/L` : "—"}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        referência: {referenciaKml != null ? `${referenciaKml.toFixed(2)} km/L` : "—"}
      </div>
      <span className={cn("mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold", badge)}>
        {ROTULO_STATUS_COMPARATIVO[status]}
        {desvioPercentual != null && ` (${desvioPercentual > 0 ? "+" : ""}${desvioPercentual}%)`}
      </span>
    </div>
  );
}

function CardEstatistica({
  label,
  valor,
  rodape,
}: {
  label: string;
  valor: string | null;
  rodape?: string;
}) {
  return (
    <div className="rounded-2xl border border-navy-800 bg-navy-900 p-6">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{valor ?? "—"}</div>
      <div className="mt-1 text-xs text-slate-500">
        {valor != null ? rodape : "sem dados suficientes ainda"}
      </div>
    </div>
  );
}
