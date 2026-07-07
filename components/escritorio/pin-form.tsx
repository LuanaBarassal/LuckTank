"use client";

import { useState, type FormEvent } from "react";
import { definirPin } from "@/app/(escritorio)/configuracoes/actions";
import { Button } from "@/components/ui/button";

export default function PinForm({ jaTemPin }: { jaTemPin: boolean }) {
  const [pin, setPin] = useState("");
  const [confirmarPin, setConfirmarPin] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setSucesso(false);
    setSalvando(true);

    const resultado = await definirPin(pin, confirmarPin);
    setSalvando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    setSucesso(true);
    setPin("");
    setConfirmarPin("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xs flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-300" htmlFor="pin-novo">
          {jaTemPin ? "Novo PIN" : "Criar PIN"}
        </label>
        <input
          id="pin-novo"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          className="min-h-touch rounded-xl border border-navy-700 bg-navy-800 px-4 text-center text-lg tracking-[0.4em] text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-300" htmlFor="pin-confirmar">
          Confirmar PIN
        </label>
        <input
          id="pin-confirmar"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={confirmarPin}
          onChange={(e) => setConfirmarPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          className="min-h-touch rounded-xl border border-navy-700 bg-navy-800 px-4 text-center text-lg tracking-[0.4em] text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
        />
      </div>
      {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}
      {sucesso && <p className="text-sm font-medium text-sucesso-400">PIN salvo.</p>}
      <Button type="submit" disabled={salvando || pin.length !== 6 || confirmarPin.length !== 6}>
        {salvando ? "Salvando..." : jaTemPin ? "Atualizar PIN" : "Criar PIN"}
      </Button>
    </form>
  );
}
