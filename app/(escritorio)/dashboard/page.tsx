import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import GraficoBarra from "@/components/escritorio/grafico-barra";
import { formatarMoeda } from "@/lib/formatacao";
import {
  agregarGastoPorDia,
  agregarPrecoMedioPorDia,
  agregarConsumoPorVeiculo,
  agregarConsumoPorMotorista,
  agregarPostosUtilizados,
  type AbastecimentoAgregavel,
} from "@/lib/dashboard/agregacoes";

const JANELA_DIAS = 90;

function SemDados() {
  return <p className="text-sm text-neutral-500">Sem dados suficientes ainda.</p>;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - JANELA_DIAS);

  const { data: abastecimentos } = await supabase
    .from("abastecimentos")
    .select(
      "data_abastecimento, litros, valor_total, consumo_kml, veiculo_id, motorista_id, motorista_nome_livre, posto_nome"
    )
    .eq("status", "ativo")
    .gte("data_abastecimento", dataLimite.toISOString().slice(0, 10))
    .order("data_abastecimento", { ascending: true });

  const lista: AbastecimentoAgregavel[] = abastecimentos ?? [];

  const idsVeiculos = [...new Set(lista.map((a) => a.veiculo_id))];
  const idsMotoristas = [
    ...new Set(lista.map((a) => a.motorista_id).filter((id): id is string => !!id)),
  ];

  const { data: veiculos } = idsVeiculos.length
    ? await supabase.from("veiculos").select("id, placa").in("id", idsVeiculos)
    : { data: [] as { id: string; placa: string }[] };

  const { data: motoristas } = idsMotoristas.length
    ? await supabase.from("motoristas").select("id, nome").in("id", idsMotoristas)
    : { data: [] as { id: string; nome: string }[] };

  const mapaPlacas = new Map((veiculos ?? []).map((v) => [v.id, v.placa]));
  const mapaMotoristas = new Map((motoristas ?? []).map((m) => [m.id, m.nome]));

  const hoje = new Date().toISOString().slice(0, 10);
  const doDia = lista.filter((a) => a.data_abastecimento === hoje);
  const litrosHoje = doDia.reduce((soma, a) => soma + a.litros, 0);
  const valorHoje = doDia.reduce((soma, a) => soma + a.valor_total, 0);
  const precoMedioHoje = litrosHoje > 0 ? valorHoje / litrosHoje : 0;

  const gastoPorDia = agregarGastoPorDia(lista);
  const precoMedioPorDia = agregarPrecoMedioPorDia(lista);
  const consumoPorVeiculo = agregarConsumoPorVeiculo(lista, mapaPlacas);
  const consumoPorMotorista = agregarConsumoPorMotorista(lista, mapaMotoristas);
  const postosUtilizados = agregarPostosUtilizados(lista);

  const RESUMO = [
    { label: "Litros hoje", valor: `${litrosHoje.toFixed(1)} L` },
    { label: "Valor gasto hoje", valor: formatarMoeda(valorHoje) },
    { label: "Nº de abastecimentos", valor: String(doDia.length) },
    { label: "Preço médio/litro", valor: formatarMoeda(precoMedioHoje) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {RESUMO.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-sm text-slate-400">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold">{item.valor}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-slate-900 text-slate-100">
          <CardTitle>Gasto por dia (últimos {JANELA_DIAS} dias)</CardTitle>
          {gastoPorDia.length ? (
            <GraficoBarra dados={gastoPorDia} chaveX="data" chaveY="valor" />
          ) : (
            <SemDados />
          )}
        </Card>

        <Card className="bg-slate-900 text-slate-100">
          <CardTitle>Preço médio por litro</CardTitle>
          {precoMedioPorDia.length ? (
            <GraficoBarra dados={precoMedioPorDia} chaveX="data" chaveY="precoMedio" corBarra="#3b82f6" />
          ) : (
            <SemDados />
          )}
        </Card>

        <Card className="bg-slate-900 text-slate-100">
          <CardTitle>Consumo médio por ônibus (km/L)</CardTitle>
          {consumoPorVeiculo.length ? (
            <GraficoBarra dados={consumoPorVeiculo} chaveX="nome" chaveY="consumoMedio" corBarra="#f59e0b" />
          ) : (
            <SemDados />
          )}
        </Card>

        <Card className="bg-slate-900 text-slate-100">
          <CardTitle>Consumo médio por motorista (km/L)</CardTitle>
          {consumoPorMotorista.length ? (
            <GraficoBarra dados={consumoPorMotorista} chaveX="nome" chaveY="consumoMedio" corBarra="#a855f7" />
          ) : (
            <SemDados />
          )}
        </Card>

        <Card className="bg-slate-900 text-slate-100 lg:col-span-2">
          <CardTitle>Postos mais utilizados</CardTitle>
          {postosUtilizados.length ? (
            <GraficoBarra dados={postosUtilizados} chaveX="posto" chaveY="quantidade" corBarra="#22d3ee" />
          ) : (
            <SemDados />
          )}
        </Card>
      </div>

      <p className="text-xs text-neutral-500">
        Mapa dos abastecimentos: pendente — depende de geolocalização, que não
        é capturada hoje (corte de escopo deliberado). Ver PROJETO.md.
      </p>
    </div>
  );
}
