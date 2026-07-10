"use client";

// Miniatura clicável do comprovante no histórico do escritório — ao clicar,
// abre a foto em tamanho grande (lightbox) com opção de baixar o original.
// A imagem em si nunca é servida direto do Storage (bucket privado desde a
// 0007) — sempre via `/api/midias/[id]`, rota autenticada que confere a
// linha de `midias` com RLS antes de liberar o arquivo (ver o route handler
// pra detalhe do isolamento por tenant).

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  midiaId: string;
  // Rótulo da foto (captura guiada de 3 fotos, Bloco 5) — "Cupom"/"Bomba"/
  // "Hodômetro". Opcional: sem ele, o componente se comporta como antes
  // (usado em qualquer lugar que só tenha uma foto genérica).
  rotulo?: string;
  // Realça a miniatura (borda/anel âmbar) quando essa foto especificamente
  // está envolvida num alerta de divergência (Bloco 4) — ajuda o escritório
  // a ver de relance QUAL das 3 fotos motivou a suspeita, sem precisar
  // caçar isso no painel de Alertas separado.
  destaque?: boolean;
}

export default function FotoComprovante({ midiaId, rotulo, destaque }: Props) {
  const [aberto, setAberto] = useState(false);
  const urlVisualizacao = `/api/midias/${midiaId}`;
  const urlDownload = `/api/midias/${midiaId}?baixar=1`;

  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={cn(
            "block h-12 w-12 overflow-hidden rounded-lg border transition hover:border-cyan-600",
            destaque ? "border-2 border-atencao-500" : "border-navy-800"
          )}
          aria-label={rotulo ? `Ver foto: ${rotulo}` : "Ver foto do comprovante"}
          title={destaque ? `${rotulo ?? "Foto"} — envolvida num alerta de divergência` : rotulo}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- vem de rota autenticada nossa, não de storage otimizável pelo next/image */}
          <img src={urlVisualizacao} alt="Miniatura do comprovante" className="h-full w-full object-cover" />
        </button>
        {rotulo && (
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-wide",
              destaque ? "text-atencao-400" : "text-slate-500"
            )}
          >
            {rotulo}
            {destaque && " ⚠"}
          </span>
        )}
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="flex max-h-full max-w-2xl flex-col gap-3"
            onClick={(evento) => evento.stopPropagation()}
          >
            {rotulo && <p className="text-center text-sm font-semibold text-white">{rotulo}</p>}
            {/* eslint-disable-next-line @next/next/no-img-element -- mesma rota autenticada acima, só em tamanho grande */}
            <img
              src={urlVisualizacao}
              alt="Comprovante do abastecimento"
              className="max-h-[80vh] w-full rounded-xl object-contain"
            />
            <div className="flex items-center justify-between">
              <a
                href={urlDownload}
                className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-navy-800"
              >
                Baixar original
              </a>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
