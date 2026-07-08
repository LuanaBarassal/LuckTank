"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { atualizarProximaRenovacao } from "@/app/(escritorio)/admin-sistema/actions";
import { formatarDataBr } from "@/lib/formatacao";

interface Props {
  empresaId: string;
  proximaRenovacao: string | null;
}

// Só um lembrete visual pro dono do sistema — sem isso, controlar quem já
// pagou vira memória, o que não escala além de poucos clientes. Cores
// seguem os mesmos tokens semânticos de alerta usados no resto do app
// (critico/atencao/sucesso), pra pular aos olhos direto na lista.
function statusRenovacao(dataIso: string | null): { rotulo: string; classe: string } | null {
  if (!dataIso) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${dataIso}T00:00:00`);
  const diasRestantes = Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) return { rotulo: "Vencida", classe: "bg-critico-500/15 text-critico-400" };
  if (diasRestantes <= 30) return { rotulo: "Vence em breve", classe: "bg-atencao-500/15 text-atencao-400" };
  return { rotulo: "Em dia", classe: "bg-sucesso-500/15 text-sucesso-400" };
}

export default function RenovacaoEmpresaEditor({ empresaId, proximaRenovacao }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(proximaRenovacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const resultado = await atualizarProximaRenovacao(empresaId, valor || null);
    setSalvando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    setEditando(false);
    router.refresh();
  }

  if (editando) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="min-h-touch rounded-lg border border-navy-700 bg-navy-800 px-2 text-xs text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
        />
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="text-xs font-medium text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditando(false);
            setValor(proximaRenovacao ?? "");
            setErro(null);
          }}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Cancelar
        </button>
        {erro && <span className="text-xs font-medium text-critico-400">{erro}</span>}
      </div>
    );
  }

  const status = statusRenovacao(proximaRenovacao);

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="flex items-center gap-2 text-xs text-slate-400 transition hover:text-white"
    >
      {proximaRenovacao ? (
        <>
          <span>Renova em {formatarDataBr(proximaRenovacao)}</span>
          {status && (
            <span className={`rounded-full px-2 py-0.5 font-medium ${status.classe}`}>{status.rotulo}</span>
          )}
        </>
      ) : (
        <span className="underline decoration-dotted">Marcar data de renovação</span>
      )}
    </button>
  );
}
