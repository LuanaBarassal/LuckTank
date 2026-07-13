"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { atualizarEmailNotificacaoPropria } from "@/app/(escritorio)/configuracoes/actions";
import { Button } from "@/components/ui/button";

interface Props {
  emailAtual: string | null;
  podeEditar: boolean;
}

// Self-service pro administrador da própria empresa — mesmo campo também
// editável de fora, em /admin-sistema (EmailNotificacaoEmpresaEditor), pro
// dono do sistema deixar configurado no onboarding. Papel supervisor/gerente
// vê o valor atual mas o input fica desabilitado (não é escondido — saber
// pra onde os avisos vão é útil pra qualquer papel, só não pode trocar).
export default function EmailNotificacaoForm({ emailAtual, podeEditar }: Props) {
  const router = useRouter();
  const [valor, setValor] = useState(emailAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setSucesso(false);
    setSalvando(true);

    const resultado = await atualizarEmailNotificacaoPropria(valor.trim() || null);
    setSalvando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    setSucesso(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xs flex-col gap-3">
      <input
        type="email"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        disabled={!podeEditar}
        placeholder="escritorio@empresa.com"
        className="min-h-touch rounded-xl border border-navy-700 bg-navy-800 px-4 text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60"
      />
      {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}
      {sucesso && <p className="text-sm font-medium text-sucesso-400">E-mail salvo.</p>}
      {podeEditar && (
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      )}
    </form>
  );
}
