// Busca as opções pros selects de filtro (veículo/motorista) — sempre o
// universo inteiro da empresa (RLS já isola por empresa_id), nunca só o que
// aparece no período filtrado, senão o próprio filtro de veículo/motorista
// ficaria preso ao resultado que ele mesmo ainda vai produzir.

import type { createClient } from "@/lib/supabase/server";

export interface OpcaoSelect {
  value: string;
  label: string;
}

export interface OpcoesFiltro {
  veiculos: { id: string; placa: string }[];
  opcoesMotorista: OpcaoSelect[];
}

export async function buscarOpcoesFiltro(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<OpcoesFiltro> {
  const [{ data: veiculos }, { data: motoristas }, { data: nomesLivresRaw }] = await Promise.all([
    supabase.from("veiculos").select("id, placa").order("placa"),
    supabase.from("motoristas").select("id, nome").order("nome"),
    supabase
      .from("abastecimentos")
      .select("motorista_nome_livre")
      .eq("status", "ativo")
      .not("motorista_nome_livre", "is", null),
  ]);

  const nomesLivres = [
    ...new Set((nomesLivresRaw ?? []).map((r) => r.motorista_nome_livre as string)),
  ].sort((a, b) => a.localeCompare(b));

  const opcoesMotorista: OpcaoSelect[] = [
    ...(motoristas ?? []).map((m) => ({ value: `id:${m.id}`, label: m.nome })),
    ...nomesLivres.map((nome) => ({ value: `livre:${nome}`, label: `${nome} (não cadastrado)` })),
  ];

  return { veiculos: veiculos ?? [], opcoesMotorista };
}
