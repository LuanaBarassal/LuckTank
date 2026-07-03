"use client";

// Barra de filtros reutilizada no dashboard (visão geral) e na aba do
// ônibus (veículo já fixo pela rota — por isso `veiculos` é opcional: quando
// omitido, o seletor de veículo nem aparece). Só escreve na URL (query
// params) — quem lê e aplica o filtro de verdade é o Server Component da
// página, então a filtragem em si acontece no servidor, nunca aqui.

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { calcularPeriodo, type AtalhoPeriodo } from "@/lib/filtros/periodo";
import { formatarVeiculo } from "@/lib/formatacao";
import SelectBusca, { type OpcaoSelectBusca } from "./select-busca";

const ATALHOS: { valor: AtalhoPeriodo; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7dias", rotulo: "Últimos 7 dias" },
  { valor: "esteMes", rotulo: "Este mês" },
  { valor: "mesPassado", rotulo: "Mês passado" },
];

interface FiltrosAbastecimentoProps {
  veiculos?: { id: string; placa: string; prefixo: string | null }[];
  opcoesMotorista: OpcaoSelectBusca[];
}

export default function FiltrosAbastecimento({ veiculos, opcoesMotorista }: FiltrosAbastecimentoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  const veiculoId = searchParams.get("veiculo_id");
  const motoristaIdParam = searchParams.get("motorista_id");
  const motoristaNomeParam = searchParams.get("motorista_nome");

  const valorMotorista = motoristaIdParam
    ? `id:${motoristaIdParam}`
    : motoristaNomeParam
      ? `livre:${motoristaNomeParam}`
      : null;

  const atalhoAtivo = useMemo<AtalhoPeriodo | "personalizado">(() => {
    if (!de && !ate) return "esteMes";
    for (const { valor } of ATALHOS) {
      const calculado = calcularPeriodo(valor);
      if (calculado.de === de && calculado.ate === ate) return valor;
    }
    return "personalizado";
  }, [de, ate]);

  const periodoPadrao = useMemo(() => calcularPeriodo("esteMes"), []);

  const atualizarParams = useCallback(
    (mudancas: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [chave, valor] of Object.entries(mudancas)) {
        if (valor === null) params.delete(chave);
        else params.set(chave, valor);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const aplicarAtalho = (atalho: AtalhoPeriodo) => {
    const periodo = calcularPeriodo(atalho);
    atualizarParams({ de: periodo.de, ate: periodo.ate });
  };

  const selecionarMotorista = (valor: string | null) => {
    if (!valor) {
      atualizarParams({ motorista_id: null, motorista_nome: null });
      return;
    }
    if (valor.startsWith("id:")) {
      atualizarParams({ motorista_id: valor.slice(3), motorista_nome: null });
    } else {
      atualizarParams({ motorista_nome: valor.slice(6), motorista_id: null });
    }
  };

  const temFiltroAtivo = Boolean(de || ate || veiculoId || motoristaIdParam || motoristaNomeParam);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-navy-800 bg-navy-900 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {ATALHOS.map((atalho) => (
          <button
            key={atalho.valor}
            type="button"
            onClick={() => aplicarAtalho(atalho.valor)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              atalhoAtivo === atalho.valor
                ? "bg-cyan-500/20 text-cyan-300"
                : "bg-navy-950 text-slate-400 hover:text-white"
            )}
          >
            {atalho.rotulo}
          </button>
        ))}
        <span
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium",
            atalhoAtivo === "personalizado" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-500"
          )}
        >
          Personalizado
        </span>

        {temFiltroAtivo && (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="ml-auto text-xs font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className={cn("grid gap-3 sm:grid-cols-2", veiculos ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">De</label>
          <input
            type="date"
            value={de ?? periodoPadrao.de}
            onChange={(evento) => atualizarParams({ de: evento.target.value || null })}
            className="min-h-touch rounded-xl border border-navy-800 bg-navy-950 px-3 text-sm text-white outline-none focus:border-cyan-600"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">Até</label>
          <input
            type="date"
            value={ate ?? periodoPadrao.ate}
            onChange={(evento) => atualizarParams({ ate: evento.target.value || null })}
            className="min-h-touch rounded-xl border border-navy-800 bg-navy-950 px-3 text-sm text-white outline-none focus:border-cyan-600"
          />
        </div>

        {veiculos && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">Veículo</label>
            <SelectBusca
              opcoes={veiculos.map((v) => ({ value: v.id, label: formatarVeiculo(v.prefixo, v.placa) }))}
              valor={veiculoId}
              aoSelecionar={(valor) => atualizarParams({ veiculo_id: valor })}
              placeholder="Todos os veículos"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">Motorista</label>
          <SelectBusca
            opcoes={opcoesMotorista}
            valor={valorMotorista}
            aoSelecionar={selecionarMotorista}
            placeholder="Todos os motoristas"
          />
        </div>
      </div>
    </div>
  );
}
