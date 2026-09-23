"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { atualizarDadosNotaFiscal } from "@/app/(escritorio)/configuracoes/actions";
import { Button } from "@/components/ui/button";

interface Props {
  // Já formatados pra exibição (a página formata o que vem só com dígitos).
  cnpjAtual: string | null;
  whatsappAtual: string | null;
  emailAtual: string | null;
  podeEditar: boolean;
}

// Mesmo padrão do EmailNotificacaoForm: administrador edita; os outros
// papéis veem os valores (útil saber o que está na etiqueta), mas não trocam.
export default function DadosNotaFiscalForm({ cnpjAtual, whatsappAtual, emailAtual, podeEditar }: Props) {
  const router = useRouter();
  const [cnpj, setCnpj] = useState(cnpjAtual ?? "");
  const [whatsapp, setWhatsapp] = useState(whatsappAtual ?? "");
  const [email, setEmail] = useState(emailAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setSucesso(false);
    setSalvando(true);

    const resultado = await atualizarDadosNotaFiscal({
      cnpj: cnpj.trim() || null,
      whatsapp: whatsapp.trim() || null,
      email: email.trim() || null,
    });
    setSalvando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    setSucesso(true);
    router.refresh();
  }

  const classeInput =
    "min-h-touch rounded-xl border border-navy-700 bg-navy-800 px-4 text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60";

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xs flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
        CNPJ para emitir a nota
        <input
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          disabled={!podeEditar}
          inputMode="numeric"
          placeholder="00.000.000/0000-00"
          className={classeInput}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
        WhatsApp para receber o comprovante
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          disabled={!podeEditar}
          inputMode="tel"
          placeholder="(00) 00000-0000"
          className={classeInput}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
        E-mail para receber o comprovante
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!podeEditar}
          placeholder="notas@empresa.com"
          className={classeInput}
        />
      </label>
      {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}
      {sucesso && <p className="text-sm font-medium text-sucesso-400">Dados salvos.</p>}
      {podeEditar && (
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      )}
    </form>
  );
}
