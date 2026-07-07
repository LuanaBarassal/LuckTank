"use client";

import { useEffect, useState } from "react";
import { listarFila, removerDaFila, type ItemFila } from "@/lib/offline/db";
import { sincronizarFila } from "@/lib/offline/sync";

// Visibilidade da fila local de abastecimentos que não conseguiram
// sincronizar — sem isto, um registro bloqueado por regra de negócio (ex.:
// KM menor que o último registrado) ficava marcado "erro" no IndexedDB do
// aparelho sem nenhuma tela mostrando isso: pra um produto anti-fraude,
// "o abastecimento nunca entrou no sistema" é exatamente o cenário que se
// quer evitar, e ele podia acontecer em silêncio, contido no celular do
// motorista. `sincronizarFila()` já reprocessa a fila inteira (pendente +
// erro) a cada chamada — aqui só decide QUANDO chamar (botão explícito) e
// mostra o resultado.
export default function FilaPendencias() {
  const [itensComErro, setItensComErro] = useState<ItemFila[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  async function recarregar() {
    const fila = await listarFila();
    setItensComErro(fila.filter((item) => item.status === "erro"));
  }

  useEffect(() => {
    recarregar();
    window.addEventListener("online", recarregar);
    return () => window.removeEventListener("online", recarregar);
  }, []);

  async function handleTentarNovamente() {
    setSincronizando(true);
    await sincronizarFila();
    await recarregar();
    setSincronizando(false);
  }

  async function handleDescartar(registroUuid: string) {
    await removerDaFila(registroUuid);
    await recarregar();
  }

  if (itensComErro.length === 0) return null;

  return (
    <div className="rounded-2xl border border-atencao-400 bg-atencao-50 p-4 text-sm text-atencao-700">
      <p className="font-semibold text-atencao-700">
        {itensComErro.length === 1
          ? "1 abastecimento salvo neste aparelho não foi enviado"
          : `${itensComErro.length} abastecimentos salvos neste aparelho não foram enviados`}
      </p>

      <ul className="mt-2 flex flex-col gap-2">
        {itensComErro.map((item) => (
          <li key={item.registroUuid} className="rounded-xl bg-white/70 p-3">
            <p className="text-xs text-atencao-600">
              Salvo em {new Date(item.criadoEm).toLocaleString("pt-BR")} ·{" "}
              {item.tentativas} {item.tentativas === 1 ? "tentativa" : "tentativas"}
            </p>
            <p className="mt-1 font-medium text-atencao-700">
              {item.erro ?? "Erro desconhecido."}
            </p>
            <button
              type="button"
              onClick={() => handleDescartar(item.registroUuid)}
              className="mt-2 text-xs font-semibold text-atencao-700 underline underline-offset-2"
            >
              Descartar este registro
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleTentarNovamente}
        disabled={sincronizando}
        className="min-h-touch mt-3 w-full rounded-xl bg-atencao-600 px-4 text-sm font-semibold text-white transition hover:bg-atencao-700 disabled:opacity-60"
      >
        {sincronizando ? "Tentando novamente…" : "Tentar enviar novamente"}
      </button>
    </div>
  );
}
