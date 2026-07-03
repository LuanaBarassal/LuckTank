"use client";

// Combobox mínimo (sem lib externa, mesma filosofia dos componentes de UI já
// existentes — Button/Card/Input são todos hand-rolled): campo de texto pra
// filtrar uma lista curta de opções (veículos/motoristas da empresa, no
// máximo algumas dezenas no piloto), clique pra selecionar, "x" pra limpar.

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface OpcaoSelectBusca {
  value: string;
  label: string;
}

interface SelectBuscaProps {
  opcoes: OpcaoSelectBusca[];
  valor: string | null;
  aoSelecionar: (valor: string | null) => void;
  placeholder: string;
}

export default function SelectBusca({ opcoes, valor, aoSelecionar, placeholder }: SelectBuscaProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) {
        setAberto(false);
        setBusca("");
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const selecionado = opcoes.find((o) => o.value === valor) ?? null;

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return opcoes;
    return opcoes.filter((o) => o.label.toLowerCase().includes(termo));
  }, [opcoes, busca]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex min-h-touch w-full items-center justify-between gap-2 rounded-xl border border-navy-800 bg-navy-950 px-3 text-left text-sm text-slate-200 transition hover:border-cyan-700"
      >
        <span className={cn("truncate", !selecionado && "text-slate-500")}>
          {selecionado ? selecionado.label : placeholder}
        </span>
        {selecionado ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Limpar seleção"
            onClick={(evento) => {
              evento.stopPropagation();
              aoSelecionar(null);
              setBusca("");
            }}
            onKeyDown={(evento) => {
              if (evento.key === "Enter" || evento.key === " ") {
                evento.stopPropagation();
                aoSelecionar(null);
                setBusca("");
              }
            }}
            className="shrink-0 text-slate-500 hover:text-white"
          >
            ✕
          </span>
        ) : (
          <span className="shrink-0 text-slate-500">▾</span>
        )}
      </button>

      {aberto && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-navy-800 bg-navy-900 p-2 shadow-lg">
          <input
            autoFocus
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar..."
            className="mb-2 w-full rounded-lg border border-navy-800 bg-navy-950 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-600"
          />
          <div role="listbox" className="max-h-56 overflow-y-auto">
            {filtradas.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-slate-500">Nada encontrado.</div>
            )}
            {filtradas.map((opcao) => (
              <button
                key={opcao.value}
                type="button"
                role="option"
                aria-selected={opcao.value === valor}
                onClick={() => {
                  aoSelecionar(opcao.value);
                  setAberto(false);
                  setBusca("");
                }}
                className={cn(
                  "block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5",
                  opcao.value === valor ? "text-cyan-300" : "text-slate-200"
                )}
              >
                {opcao.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
