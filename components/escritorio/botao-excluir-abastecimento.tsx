"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { excluirAbastecimento } from "@/app/(escritorio)/onibus/actions";
import { usePinProtegido } from "./pin-context";

export default function BotaoExcluirAbastecimento({ id }: { id: string }) {
  const router = useRouter();
  const { solicitarPin } = usePinProtegido();
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    const confirmado = window.confirm(
      "Excluir este abastecimento? Esta ação não pode ser desfeita."
    );
    if (!confirmado) return;

    setErro(null);
    solicitarPin(async (pin) => {
      setExcluindo(true);
      const resultado = await excluirAbastecimento(id, pin);
      setExcluindo(false);

      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={excluindo}
        className="text-xs font-semibold text-critico-400 underline-offset-2 transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
      >
        {excluindo ? "Excluindo..." : "Excluir"}
      </button>
      {erro && <p className="text-xs font-medium text-critico-400">{erro}</p>}
    </div>
  );
}
