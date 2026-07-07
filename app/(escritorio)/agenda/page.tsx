import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import FiltroVeiculoAgenda from "@/components/escritorio/filtro-veiculo-agenda";
import { buscarOpcoesFiltro } from "@/lib/filtros/opcoes";
import { formatarMoeda, formatarDataBr, formatarVeiculo } from "@/lib/formatacao";
import { ROTULO_FORMA_PAGAMENTO, FORMAS_PAGAMENTO } from "@/lib/validacao/schemas";
import { cn } from "@/lib/utils";
import {
  resolverMesReferencia,
  limitesDoMes,
  mesAnterior,
  proximoMes,
  montarGradeMes,
  type AbastecimentoAgenda,
} from "@/lib/dashboard/agenda";

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function rotuloMes(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  return `${NOMES_MES[mes - 1]} de ${ano}`;
}

function rotuloFormaPagamento(valor: string | null): string {
  if (!valor) return "—";
  return (FORMAS_PAGAMENTO as readonly string[]).includes(valor)
    ? ROTULO_FORMA_PAGAMENTO[valor as (typeof FORMAS_PAGAMENTO)[number]]
    : valor;
}

function campoUnico(searchParams: Record<string, string | string[] | undefined>, chave: string): string | null {
  const valor = searchParams[chave];
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto && texto.length > 0 ? texto : null;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createClient();

  const veiculoIdParam = campoUnico(searchParams, "veiculo_id");
  const diaParam = campoUnico(searchParams, "dia");
  const mesReferencia = resolverMesReferencia(campoUnico(searchParams, "mes"));
  const { de, ate } = limitesDoMes(mesReferencia);

  const { veiculos, opcoesMotorista } = await buscarOpcoesFiltro(supabase);
  const mapaPlacas = new Map(veiculos.map((v) => [v.id, formatarVeiculo(v.prefixo, v.placa)]));
  const mapaMotoristas = new Map(
    opcoesMotorista.filter((o) => o.value.startsWith("id:")).map((o) => [o.value.slice(3), o.label])
  );

  let query = supabase
    .from("abastecimentos")
    .select(
      "id, data_abastecimento, hora, litros, valor_total, km_atual, km_rodado, consumo_kml, posto_nome, posto_cidade, posto_uf, forma_pagamento, numero_nota, bandeira_posto, veiculo_id, motorista_id, motorista_nome_livre"
    )
    .eq("status", "ativo")
    .gte("data_abastecimento", de)
    .lte("data_abastecimento", ate);

  if (veiculoIdParam) query = query.eq("veiculo_id", veiculoIdParam);

  const { data: abastecimentosRaw } = await query.order("data_abastecimento", { ascending: true });

  const lista: AbastecimentoAgenda[] = (abastecimentosRaw ?? []).map((a) => ({
    id: a.id,
    data_abastecimento: a.data_abastecimento,
    hora: a.hora,
    litros: a.litros,
    valor_total: a.valor_total,
    km_atual: a.km_atual,
    km_rodado: a.km_rodado,
    consumo_kml: a.consumo_kml,
    posto_nome: a.posto_nome,
    posto_cidade: a.posto_cidade,
    posto_uf: a.posto_uf,
    forma_pagamento: a.forma_pagamento,
    numero_nota: a.numero_nota,
    bandeira_posto: a.bandeira_posto,
    veiculoNome: mapaPlacas.get(a.veiculo_id) ?? "—",
    motoristaNome: a.motorista_id
      ? mapaMotoristas.get(a.motorista_id) ?? "—"
      : a.motorista_nome_livre ?? "—",
  }));

  const grade = montarGradeMes(mesReferencia, lista);
  const hojeIso = new Date().toISOString().slice(0, 10);

  // Dia selecionado: o da URL, se existir na grade deste mês; senão hoje
  // (só se hoje cair dentro do mês sendo exibido); senão nenhum.
  const diaSelecionado =
    diaParam && grade.some((d) => d.data === diaParam)
      ? diaParam
      : grade.some((d) => d.data === hojeIso && d.noMesReferencia)
        ? hojeIso
        : null;

  const itensDoDiaSelecionado = diaSelecionado
    ? grade.find((d) => d.data === diaSelecionado)?.itens ?? []
    : [];

  function linkMes(mes: string): string {
    const params = new URLSearchParams();
    params.set("mes", mes);
    if (veiculoIdParam) params.set("veiculo_id", veiculoIdParam);
    return `/agenda?${params.toString()}`;
  }

  function linkDia(dia: string): string {
    const params = new URLSearchParams();
    params.set("mes", mesReferencia);
    if (veiculoIdParam) params.set("veiculo_id", veiculoIdParam);
    params.set("dia", dia);
    return `/agenda?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-title text-2xl font-bold text-white">Agenda</h1>
        <Suspense fallback={<div className="h-12 w-64 rounded-xl border border-navy-800 bg-navy-900" />}>
          <FiltroVeiculoAgenda veiculos={veiculos} />
        </Suspense>
      </div>

      <Card variant="dark">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href={linkMes(mesAnterior(mesReferencia))}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
          >
            ← Anterior
          </Link>
          <CardTitle variant="dark" className="mb-0">
            {rotuloMes(mesReferencia)}
          </CardTitle>
          <Link
            href={linkMes(proximoMes(mesReferencia))}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
          >
            Próximo →
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="pb-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {grade.map((dia) => {
            const temItens = dia.itens.length > 0;
            const selecionado = dia.data === diaSelecionado;
            const ehHoje = dia.data === hojeIso;
            return (
              <Link
                key={dia.data}
                href={linkDia(dia.data)}
                className={cn(
                  "flex min-h-[64px] flex-col items-center justify-start gap-1 rounded-xl border p-2 text-sm transition",
                  !dia.noMesReferencia && "border-transparent text-slate-700",
                  dia.noMesReferencia && !selecionado && "border-navy-800 text-slate-300 hover:border-cyan-700",
                  selecionado && "border-cyan-500 bg-cyan-500/10 text-white"
                )}
              >
                <span className={cn("font-semibold", ehHoje && dia.noMesReferencia && "text-cyan-300")}>
                  {dia.diaDoMes}
                </span>
                {temItens && (
                  <span className="rounded-full bg-cyan-500/20 px-1.5 text-[11px] font-semibold text-cyan-300">
                    {dia.itens.length}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </Card>

      <Card variant="dark">
        <CardTitle variant="dark">
          {diaSelecionado ? `Abastecimentos em ${formatarDataBr(diaSelecionado)}` : "Selecione um dia no calendário"}
        </CardTitle>

        {diaSelecionado && itensDoDiaSelecionado.length === 0 && (
          <p className="text-sm text-slate-400">Nenhum abastecimento registrado neste dia.</p>
        )}

        <div className="flex flex-col gap-3">
          {itensDoDiaSelecionado.map((item) => {
            const valorPorLitro = item.litros > 0 ? item.valor_total / item.litros : null;
            return (
              <div key={item.id} className="rounded-xl border border-navy-800 bg-navy-950 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-white">{item.veiculoNome}</span>
                  <span className="text-sm text-slate-400">
                    {item.hora ? `${item.hora} · ` : ""}
                    {item.motoristaNome}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm sm:grid-cols-4">
                  <Info label="Litros" valor={`${item.litros.toFixed(1)} L`} />
                  <Info label="Valor total" valor={formatarMoeda(item.valor_total)} />
                  <Info label="Valor/litro" valor={valorPorLitro != null ? `${formatarMoeda(valorPorLitro)}/L` : "—"} />
                  <Info label="KM" valor={String(item.km_atual)} />
                  <Info label="KM rodado" valor={item.km_rodado != null ? String(item.km_rodado) : "—"} />
                  <Info
                    label="Consumo"
                    valor={item.consumo_kml != null ? `${item.consumo_kml.toFixed(2)} km/L` : "—"}
                  />
                  <Info
                    label="Posto"
                    valor={[item.posto_nome, item.posto_cidade, item.posto_uf].filter(Boolean).join(" · ") || "—"}
                  />
                  <Info label="Bandeira" valor={item.bandeira_posto ?? "—"} />
                  <Info label="Pagamento" valor={rotuloFormaPagamento(item.forma_pagamento)} />
                  <Info label="Nº da nota" valor={item.numero_nota ?? "—"} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium text-slate-100">{valor}</div>
    </div>
  );
}
