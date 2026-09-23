import { AVISO_OFFLINE, PASSOS_MOTORISTA } from "@/lib/etiqueta/conteudo";

// Passo a passo impresso junto do QR do veículo (etiqueta). O texto mora em
// lib/etiqueta/conteudo.ts — compartilhado com o PDF gerado no servidor
// (lib/etiqueta/pdf.ts), pra página e PDF nunca divergirem.
// Preto sobre branco de propósito (alto contraste em impressora comum, P&B
// inclusive) — não usa nenhuma cor semântica que dependa de tinta colorida.
// Compacto (13px, espaçamento curto): a etiqueta inteira precisa caber numa
// folha A4 só, junto do QR e do bloco da nota fiscal.
export default function InstrucoesMotorista() {
  return (
    <div className="w-full text-neutral-900">
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-700">Como abastecer</p>
      <ol className="flex flex-col gap-1.5">
        {PASSOS_MOTORISTA.map((passo, indice) => (
          <li key={passo} className="flex items-start gap-2">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-neutral-900 text-xs font-bold leading-none">
              {indice + 1}
            </span>
            <span className="text-[13px] leading-snug">{passo}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-neutral-500">{AVISO_OFFLINE}</p>
    </div>
  );
}
