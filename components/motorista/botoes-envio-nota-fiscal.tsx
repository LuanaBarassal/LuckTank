"use client";

// Botões de envio da nota fiscal na tela de sucesso do motorista (Bloco 4 da
// NF). Todos são ATALHOS: abrem o app já preenchido e a pessoa confirma o
// envio lá — nada é enviado automaticamente, nada passa pelo servidor.
// - WhatsApp (wa.me) e e-mail (mailto:) levam só o texto: nenhum dos dois
//   consegue anexar arquivo.
// - "Compartilhar foto da nota" usa a Web Share API do celular, que anexa a
//   foto de verdade no app escolhido. Importante porque a foto tirada pela
//   câmera do navegador muitas vezes nem fica salva na galeria — sem isso o
//   motorista não teria como anexar. Só aparece onde o navegador suporta
//   compartilhar arquivo (maioria dos Android/iPhone atuais).

import { useEffect, useState } from "react";
import type { DadosNotaFiscalEmpresa } from "@/components/dados-nota-fiscal";
import {
  montarAssuntoNotaFiscal,
  montarMensagemNotaFiscal,
  linkWhatsappNotaFiscal,
  linkEmailNotaFiscal,
  type DadosMensagemNotaFiscal,
} from "@/lib/nota-fiscal/envio";

interface Props {
  destino: DadosNotaFiscalEmpresa;
  mensagem: DadosMensagemNotaFiscal;
  foto: File;
}

export default function BotoesEnvioNotaFiscal({ destino, mensagem, foto }: Props) {
  const [podeCompartilharFoto, setPodeCompartilharFoto] = useState(false);
  const texto = montarMensagemNotaFiscal(mensagem);
  const assunto = montarAssuntoNotaFiscal(mensagem);

  // Checado só no navegador (depois de montar) — no servidor `navigator` não
  // existe e o resultado varia por aparelho.
  useEffect(() => {
    try {
      setPodeCompartilharFoto(
        typeof navigator.canShare === "function" && navigator.canShare({ files: [foto] })
      );
    } catch {
      setPodeCompartilharFoto(false);
    }
  }, [foto]);

  async function compartilharFoto() {
    try {
      await navigator.share({ files: [foto], title: assunto, text: texto });
    } catch {
      // Cancelado pela pessoa ou não suportado — nada a fazer.
    }
  }

  if (!destino.whatsapp && !destino.email && !podeCompartilharFoto) return null;

  const classeBotao =
    "flex min-h-touch w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition";

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left">
      <p className="text-sm font-semibold text-neutral-900">Enviar a nota fiscal</p>
      <p className="text-xs text-neutral-500">
        Os botões só abrem o app com a mensagem pronta — você confere e confirma o envio lá.
      </p>

      {podeCompartilharFoto && (
        <button
          type="button"
          onClick={compartilharFoto}
          className={`${classeBotao} bg-primary-700 text-white active:bg-primary-800`}
        >
          📎 Compartilhar foto da nota
        </button>
      )}
      {destino.whatsapp && (
        <a
          href={linkWhatsappNotaFiscal(destino.whatsapp, texto)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${classeBotao} bg-[#25D366] text-white active:opacity-90`}
        >
          Abrir WhatsApp
        </a>
      )}
      {destino.email && (
        <a
          href={linkEmailNotaFiscal(destino.email, assunto, texto)}
          className={`${classeBotao} border border-neutral-300 bg-white text-neutral-800 active:bg-neutral-100`}
        >
          Abrir e-mail
        </a>
      )}

      <p className="text-xs text-neutral-500">
        {podeCompartilharFoto
          ? "WhatsApp e e-mail levam só o texto: pra mandar a foto junto, use “Compartilhar foto da nota”."
          : "WhatsApp e e-mail levam só o texto — anexe a foto da nota manualmente no app."}
      </p>
    </div>
  );
}
