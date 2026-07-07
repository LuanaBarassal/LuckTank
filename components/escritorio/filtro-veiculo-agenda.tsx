"use client";

// Filtro de veículo da agenda — próprio (não o FiltrosAbastecimento) porque
// a agenda navega por MÊS (setas ← →), não por intervalo de data livre
// (de/até); reaproveita só o combobox (SelectBusca), não o resto da barra.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatarVeiculo } from "@/lib/formatacao";
import SelectBusca from "./select-busca";

interface Props {
  veiculos: { id: string; placa: string; prefixo: string | null }[];
}

export default function FiltroVeiculoAgenda({ veiculos }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const veiculoId = searchParams.get("veiculo_id");

  function selecionar(valor: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    // Trocar de veículo mantém o mês, mas solta o dia selecionado — o dia
    // escolhido pode não ter abastecimento nenhum do novo veículo.
    params.delete("dia");
    if (valor) params.set("veiculo_id", valor);
    else params.delete("veiculo_id");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="w-full sm:w-64">
      <SelectBusca
        opcoes={veiculos.map((v) => ({ value: v.id, label: formatarVeiculo(v.prefixo, v.placa) }))}
        valor={veiculoId}
        aoSelecionar={selecionar}
        placeholder="Todos os veículos"
      />
    </div>
  );
}
