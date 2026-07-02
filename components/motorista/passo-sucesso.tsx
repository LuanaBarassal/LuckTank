"use client";

import { Button } from "@/components/ui/button";

interface Props {
  offline?: boolean;
  onNovoRegistro: () => void;
}

export default function PassoSucesso({ offline, onNovoRegistro }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-3xl text-primary-700">
        ✓
      </div>
      <h2 className="text-xl font-semibold text-neutral-900">Abastecimento registrado!</h2>
      <p className="text-sm text-neutral-500">
        {offline
          ? "Você está sem internet — salvamos no aparelho e vamos enviar assim que a conexão voltar."
          : "Obrigado. Os dados já foram enviados para o escritório."}
      </p>
      <Button onClick={onNovoRegistro}>Registrar outro abastecimento</Button>
    </div>
  );
}
