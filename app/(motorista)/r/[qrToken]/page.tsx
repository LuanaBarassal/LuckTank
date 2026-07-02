import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import FluxoAbastecimento from "@/components/motorista/fluxo-abastecimento";

// Nunca cachear: km_atual, último abastecimento e a lista de motoristas
// precisam estar sempre atualizados — o bloqueio de KM depende disso.
// `dynamic` sozinho não bastou pra evitar cache dos fetches internos do
// client do Supabase — força explicitamente também fetchCache/revalidate.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Resolução do QR: veículo E empresa vêm do qr_token, sempre no servidor,
// via service role — nunca de um empresa_id/veiculo_id vindo do client.
export default async function AberturaVeiculoPage({
  params,
}: {
  params: { qrToken: string };
}) {
  const admin = createAdminClient();

  const { data: veiculo } = await admin
    .from("veiculos")
    .select("id, placa, modelo, ano, km_atual, ativo, empresa_id")
    .eq("qr_token", params.qrToken)
    .single();

  if (!veiculo || !veiculo.ativo) notFound();

  const { data: empresa } = await admin
    .from("empresas")
    .select("nome")
    .eq("id", veiculo.empresa_id)
    .single();

  const { data: motoristas } = await admin
    .from("motoristas")
    .select("id, nome")
    .eq("empresa_id", veiculo.empresa_id)
    .eq("ativo", true)
    .order("nome");

  const { data: ultimoAbastecimento } = await admin
    .from("abastecimentos")
    .select("data_abastecimento, km_atual, litros")
    .eq("veiculo_id", veiculo.id)
    .eq("status", "ativo")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <FluxoAbastecimento
      qrToken={params.qrToken}
      empresaNome={empresa?.nome ?? "Empresa não encontrada"}
      veiculo={{
        id: veiculo.id,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        ano: veiculo.ano,
        kmAtual: veiculo.km_atual,
      }}
      motoristas={motoristas ?? []}
      ultimoAbastecimento={ultimoAbastecimento ?? null}
    />
  );
}
