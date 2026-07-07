"use client";

// Substitui o antigo `<a href="/api/export?...">` — precisa virar um clique
// em JS (não navegação direta) porque o PIN tem que ir num header da
// requisição, nunca na URL (senão fica gravado no histórico do navegador e
// em qualquer log de acesso no caminho). O download em si (Content-Disposition,
// nome do arquivo) é replicado na mão: busca o arquivo via fetch, monta um
// blob e simula o clique num <a> temporário.

import { useState } from "react";
import { usePinProtegido } from "./pin-context";

interface Props {
  href: string;
  children: React.ReactNode;
}

function extrairNomeArquivo(headerContentDisposition: string | null): string | null {
  if (!headerContentDisposition) return null;
  const match = headerContentDisposition.match(/filename="?([^"]+)"?/);
  return match ? match[1] : null;
}

export default function LinkExportacaoProtegida({ href, children }: Props) {
  const { solicitarPin } = usePinProtegido();
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function iniciar() {
    setErro(null);
    solicitarPin(async (pin) => {
      setBaixando(true);
      try {
        const resposta = await fetch(href, { headers: { "x-lucktank-pin": pin } });

        if (!resposta.ok) {
          const corpo = await resposta.json().catch(() => null);
          setErro(corpo?.error ?? "Não foi possível baixar o arquivo.");
          return;
        }

        const blob = await resposta.blob();
        const nomeArquivo = extrairNomeArquivo(resposta.headers.get("content-disposition")) ?? "download";
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch {
        setErro("Falha de conexão ao baixar o arquivo.");
      } finally {
        setBaixando(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={iniciar}
        disabled={baixando}
        className="inline-flex min-h-touch items-center justify-center rounded-xl border-2 border-cyan-600 px-4 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {baixando ? "Baixando..." : children}
      </button>
      {erro && <p className="text-xs font-medium text-critico-400">{erro}</p>}
    </div>
  );
}
