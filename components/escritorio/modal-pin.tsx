"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  erro: string | null;
  verificando: boolean;
  onConfirmar: (pin: string) => void;
  onFechar: () => void;
}

export default function ModalPin({ erro, verificando, onConfirmar, onFechar }: Props) {
  const [pin, setPin] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onConfirmar(pin);
    setPin("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pin-titulo"
    >
      <div className="w-full max-w-sm rounded-2xl border border-navy-800 bg-navy-900 p-6 shadow-2xl">
        <h2 id="modal-pin-titulo" className="text-lg font-bold text-white">
          Ação protegida
        </h2>
        <p className="mt-1 text-sm text-slate-400">Digite seu PIN de 6 dígitos para continuar.</p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className="min-h-touch rounded-xl border border-navy-700 bg-navy-950 px-4 text-center text-2xl tracking-[0.5em] text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
          />
          {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}

          <div className="mt-1 flex gap-3">
            {/* variant="outline"/"ghost" usam texto navy escuro — some num
                fundo já navy deste modal; "secondary" (cinza claro) é o
                único variant com contraste real aqui. */}
            <Button type="button" variant="secondary" onClick={onFechar} fullWidth>
              Cancelar
            </Button>
            <Button type="submit" fullWidth loading={verificando} disabled={pin.length !== 6}>
              Confirmar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
