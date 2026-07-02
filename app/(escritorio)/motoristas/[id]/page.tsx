import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import MotoristaForm from "@/components/escritorio/motorista-form";
import MotoristaAtivoToggle from "@/components/escritorio/motorista-ativo-toggle";
import { Card, CardTitle } from "@/components/ui/card";
import { formatarMoeda, formatarDataBr } from "@/lib/formatacao";

export default async function MotoristaDetalhePage({ params }: { params: { id: string } }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const { data: motorista } = await supabase
    .from("motoristas")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!motorista) notFound();

  const { data: abastecimentos } = await supabase
    .from("abastecimentos")
    .select("id, data_abastecimento, litros, valor_total, consumo_kml, veiculo_id")
    .eq("motorista_id", motorista.id)
    .eq("status", "ativo")
    .order("criado_em", { ascending: false })
    .limit(50);

  const lista = abastecimentos ?? [];

  const idsVeiculos = [...new Set(lista.map((a) => a.veiculo_id))];
  const { data: veiculos } = idsVeiculos.length
    ? await supabase.from("veiculos").select("id, placa").in("id", idsVeiculos)
    : { data: [] as { id: string; placa: string }[] };
  const mapaPlacas = new Map((veiculos ?? []).map((v) => [v.id, v.placa]));

  const inicioMes = new Date();
  inicioMes.setDate(1);
  const inicioMesIso = inicioMes.toISOString().slice(0, 10);
  const abastecimentosNoMes = lista.filter((a) => a.data_abastecimento >= inicioMesIso);

  const consumos = lista.map((a) => a.consumo_kml).filter((v): v is number => v != null);
  const kmLMedio = consumos.length ? consumos.reduce((s, v) => s + v, 0) / consumos.length : null;

  const idsAbastecimentos = lista.map((a) => a.id);
  const { count: alertasCriticos } = idsAbastecimentos.length
    ? await supabase
        .from("alertas")
        .select("id", { count: "exact", head: true })
        .eq("entidade_tipo", "abastecimento")
        .eq("nivel", "critico")
        .in("entidade_id", idsAbastecimentos)
    : { count: 0 };

  const podeGerenciar = usuario.papel === "gerente" || usuario.papel === "administrador";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{motorista.nome}</h1>
        {podeGerenciar && <MotoristaAtivoToggle id={motorista.id} ativo={motorista.ativo} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="bg-slate-900 text-slate-100">
          <CardTitle>Dados do motorista</CardTitle>
          {podeGerenciar ? (
            <MotoristaForm motorista={motorista} />
          ) : (
            <p className="text-sm text-neutral-400">
              Você não tem permissão para editar este motorista.
            </p>
          )}
        </Card>

        <Card className="bg-slate-900 text-slate-100">
          <CardTitle>Estatísticas</CardTitle>
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm text-slate-400">Abastecimentos no mês</div>
              <div className="text-xl font-semibold">{abastecimentosNoMes.length}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Km/L médio</div>
              <div className="text-xl font-semibold">
                {kmLMedio != null ? kmLMedio.toFixed(2) : "—"}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Alertas críticos</div>
              <div className="text-xl font-semibold text-red-400">{alertasCriticos ?? 0}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="bg-slate-900 text-slate-100">
        <CardTitle>Últimos registros</CardTitle>
        {!lista.length ? (
          <p className="text-sm text-neutral-400">Nenhum abastecimento registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 pr-4 font-medium">Ônibus</th>
                  <th className="py-2 pr-4 font-medium">Litros</th>
                  <th className="py-2 pr-4 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800/50">
                    <td className="py-2 pr-4">{formatarDataBr(a.data_abastecimento)}</td>
                    <td className="py-2 pr-4">{mapaPlacas.get(a.veiculo_id) ?? "—"}</td>
                    <td className="py-2 pr-4">{a.litros} L</td>
                    <td className="py-2 pr-4">{formatarMoeda(a.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
