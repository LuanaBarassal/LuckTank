"use client";

// Escritório anexa a nota fiscal de um abastecimento com nota pendente (o
// motorista pulou a etapa no fluxo do QR). Aceita foto (comprimida aqui no
// navegador, mesma função do fluxo do motorista) ou PDF (DANFE recebida por
// e-mail). Quem valida de verdade é a Server Action — o `accept` do input e
// a checagem de tamanho aqui são só pra dar erro rápido e amigável.

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { anexarNotaFiscal } from "@/app/(escritorio)/onibus/actions";
import { comprimirImagem } from "@/lib/offline/comprimir-imagem";

const TAMANHO_MAXIMO_PDF_BYTES = 4 * 1024 * 1024;

export default function BotaoAnexarNotaFiscal({ abastecimentoId }: { abastecimentoId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleChange(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0] ?? null;
    evento.target.value = "";
    if (!arquivo) return;

    setErro(null);
    const ehPdf = arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");
    if (ehPdf && arquivo.size > TAMANHO_MAXIMO_PDF_BYTES) {
      setErro("PDF muito grande (máximo 4MB).");
      return;
    }

    setEnviando(true);
    const formData = new FormData();
    if (ehPdf) {
      formData.set("arquivo", arquivo, arquivo.name);
    } else {
      // 1600px/0.85 (não o 1280/0.75 padrão): texto miúdo da DANFE precisa
      // continuar legível — mesmo critério usado no OCR do cupom.
      const comprimida = await comprimirImagem(arquivo, 1600, 0.85);
      formData.set("arquivo", comprimida, arquivo.name);
    }

    const resultado = await anexarNotaFiscal(abastecimentoId, formData);
    setEnviando(false);
    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        title="Anexar a nota fiscal (foto ou PDF)"
        className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-atencao-500/60 text-lg text-atencao-400 transition hover:border-atencao-400 hover:bg-atencao-500/10 disabled:cursor-wait disabled:opacity-60"
      >
        {enviando ? "…" : "+"}
      </button>
      <span className="text-[10px] font-medium uppercase tracking-wide text-atencao-400">
        {enviando ? "Enviando" : "Anexar NF"}
      </span>
      {erro && <p className="max-w-[9rem] text-center text-[10px] font-medium text-critico-400">{erro}</p>}
    </div>
  );
}
