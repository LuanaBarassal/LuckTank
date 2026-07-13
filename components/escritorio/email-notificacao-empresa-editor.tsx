"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { atualizarEmailNotificacao } from "@/app/(escritorio)/admin-sistema/actions";

interface Props {
  empresaId: string;
  emailNotificacao: string | null;
}

// Mesmo padrão de RenovacaoEmpresaEditor (click-to-edit inline) — dono do
// sistema deixa isso já configurado no onboarding do cliente, sem precisar
// de uma tela separada.
export default function EmailNotificacaoEmpresaEditor({ empresaId, emailNotificacao }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(emailNotificacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const resultado = await atualizarEmailNotificacao(empresaId, valor.trim() || null);
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
          type="email"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="escritorio@empresa.com"
          className="min-h-touch w-56 rounded-lg border border-navy-700 bg-navy-800 px-2 text-xs text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
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
            setValor(emailNotificacao ?? "");
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

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="flex items-center gap-2 text-xs text-slate-400 transition hover:text-white"
    >
      {emailNotificacao ? (
        <span>E-mail de notificação: {emailNotificacao}</span>
      ) : (
        <span className="underline decoration-dotted">Definir e-mail de notificação</span>
      )}
    </button>
  );
}
