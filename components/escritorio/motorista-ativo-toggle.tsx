"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alternarAtivoMotorista } from "@/app/(escritorio)/motoristas/actions";
import { Button } from "@/components/ui/button";

export default function MotoristaAtivoToggle({ id, ativo }: { id: string; ativo: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleClick() {
    if (ativo && !confirm("Inativar este motorista?")) return;

    setEnviando(true);
    setErro(null);
    const resultado = await alternarAtivoMotorista(id, !ativo);
    setEnviando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant={ativo ? "outline" : "secondary"} onClick={handleClick} disabled={enviando}>
        {enviando ? "Aguarde..." : ativo ? "Inativar" : "Reativar"}
      </Button>
      {erro && <span className="text-sm font-medium text-critico-400">{erro}</span>}
    </div>
  );
}
