import { createClient } from "@/lib/supabase/server";
import ListaAlertas, { type AlertaComContexto } from "@/components/escritorio/lista-alertas";
import { formatarVeiculo } from "@/lib/formatacao";

export default async function AlertasPage() {
  const supabase = await createClient();

  const { data: alertas } = await supabase
    .from("alertas")
    .select("id, entidade_id, tipo_regra, nivel, detalhes, resolvido, criado_em")
    .eq("entidade_tipo", "abastecimento")
    .order("criado_em", { ascending: false })
    .limit(100);

  const idsAbastecimentos = [...new Set((alertas ?? []).map((a) => a.entidade_id))];

  const { data: abastecimentos } = idsAbastecimentos.length
    ? await supabase
        .from("abastecimentos")
        .select("id, veiculo_id, data_abastecimento")
        .in("id", idsAbastecimentos)
    : { data: [] as { id: string; veiculo_id: string; data_abastecimento: string }[] };

  const idsVeiculos = [...new Set((abastecimentos ?? []).map((a) => a.veiculo_id))];

  const { data: veiculos } = idsVeiculos.length
    ? await supabase.from("veiculos").select("id, placa, prefixo").in("id", idsVeiculos)
    : { data: [] as { id: string; placa: string; prefixo: string | null }[] };

  const mapaAbastecimentos = new Map((abastecimentos ?? []).map((a) => [a.id, a]));
  const mapaVeiculos = new Map((veiculos ?? []).map((v) => [v.id, v]));

  const alertasComContexto: AlertaComContexto[] = (alertas ?? []).map((alerta) => {
    const abastecimento = mapaAbastecimentos.get(alerta.entidade_id);
    const veiculo = abastecimento ? mapaVeiculos.get(abastecimento.veiculo_id) : undefined;

    return {
      id: alerta.id,
      tipo_regra: alerta.tipo_regra,
      nivel: alerta.nivel as AlertaComContexto["nivel"],
      detalhes: alerta.detalhes as Record<string, unknown> | null,
      resolvido: alerta.resolvido,
      criado_em: alerta.criado_em,
      veiculoPlaca: veiculo ? formatarVeiculo(veiculo.prefixo, veiculo.placa) : null,
      abastecimentoData: abastecimento?.data_abastecimento ?? null,
    };
  });

  return (
    <div>
      <h1 className="mb-6 font-title text-2xl font-bold text-white">Alertas</h1>
      <ListaAlertas alertas={alertasComContexto} />
    </div>
  );
}
