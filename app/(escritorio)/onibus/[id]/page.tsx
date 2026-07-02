import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import VeiculoForm from "@/components/escritorio/veiculo-form";
import VeiculoAtivoToggle from "@/components/escritorio/veiculo-ativo-toggle";
import { Card, CardTitle } from "@/components/ui/card";
import { formatarMoeda, formatarDataBr } from "@/lib/formatacao";

export default async function VeiculoDetalhePage({ params }: { params: { id: string } }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const { data: veiculo } = await supabase
    .from("veiculos")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!veiculo) notFound();

  const { data: abastecimentos } = await supabase
    .from("abastecimentos")
    .select("id, data_abastecimento, km_atual, litros, valor_total, motorista_id, motorista_nome_livre")
    .eq("veiculo_id", veiculo.id)
    .eq("status", "ativo")
    .order("criado_em", { ascending: false })
    .limit(50);

  const idsMotoristas = [
    ...new Set((abastecimentos ?? []).map((a) => a.motorista_id).filter((id): id is string => !!id)),
  ];

  const { data: motoristas } = idsMotoristas.length
    ? await supabase.from("motoristas").select("id, nome").in("id", idsMotoristas)
    : { data: [] as { id: string; nome: string }[] };

  const mapaMotoristas = new Map((motoristas ?? []).map((m) => [m.id, m.nome]));

  const podeEditar = usuario.papel === "gerente" || usuario.papel === "administrador";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{veiculo.placa}</h1>
        {podeEditar && <VeiculoAtivoToggle id={veiculo.id} ativo={veiculo.ativo} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="bg-slate-900 text-slate-100">
          <CardTitle>Dados do veículo</CardTitle>
          {podeEditar ? (
            <VeiculoForm empresaId={usuario.empresa_id} veiculo={veiculo} />
          ) : (
            <p className="text-sm text-neutral-400">
              Você não tem permissão para editar este veículo.
            </p>
          )}
        </Card>

        <Card className="bg-slate-900 text-slate-100">
          <CardTitle>QR do veículo</CardTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- vem de uma Route Handler nossa, não de storage otimizável pelo next/image */}
          <img
            src={`/api/veiculos/${veiculo.id}/qr?formato=svg`}
            alt={`QR do veículo ${veiculo.placa}`}
            className="mx-auto w-48 rounded-lg bg-white p-2"
          />
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <a
              className="text-primary-400 underline"
              href={`/api/veiculos/${veiculo.id}/qr?formato=svg&baixar=1`}
            >
              Baixar SVG
            </a>
            <a
              className="text-primary-400 underline"
              href={`/api/veiculos/${veiculo.id}/qr?formato=png&baixar=1`}
            >
              Baixar PNG
            </a>
            <Link className="text-primary-400 underline" href={`/onibus/${veiculo.id}/etiqueta`}>
              Ver etiqueta para impressão
            </Link>
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            Token permanente: <code>{veiculo.qr_token}</code>
          </p>
        </Card>
      </div>

      <Card className="bg-slate-900 text-slate-100">
        <CardTitle>Histórico de abastecimentos</CardTitle>
        {!abastecimentos?.length ? (
          <p className="text-sm text-neutral-400">Nenhum abastecimento registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 pr-4 font-medium">KM</th>
                  <th className="py-2 pr-4 font-medium">Litros</th>
                  <th className="py-2 pr-4 font-medium">Valor</th>
                  <th className="py-2 pr-4 font-medium">Motorista</th>
                </tr>
              </thead>
              <tbody>
                {abastecimentos.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800/50">
                    <td className="py-2 pr-4">{formatarDataBr(a.data_abastecimento)}</td>
                    <td className="py-2 pr-4">{a.km_atual}</td>
                    <td className="py-2 pr-4">{a.litros} L</td>
                    <td className="py-2 pr-4">{formatarMoeda(a.valor_total)}</td>
                    <td className="py-2 pr-4">
                      {a.motorista_nome_livre ?? (a.motorista_id ? mapaMotoristas.get(a.motorista_id) : null) ?? "—"}
                    </td>
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
