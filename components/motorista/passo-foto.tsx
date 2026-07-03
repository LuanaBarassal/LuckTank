"use client";

import { useRef, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  preview: string | null;
  mensagemErro?: string | null;
  onFotoChange: (file: File | null) => void;
  onVoltar: () => void;
  onContinuar: () => void;
}

export default function PassoFoto({
  preview,
  mensagemErro,
  onFotoChange,
  onVoltar,
  onContinuar,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFotoChange(event.target.files?.[0] ?? null);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-neutral-900">Foto do comprovante</h2>
      <p className="text-sm text-neutral-500">
        Tire uma foto legível do cupom/nota do abastecimento.
      </p>

      {mensagemErro && (
        <p className="rounded-lg bg-critico-50 px-3 py-2 text-sm font-medium text-critico-700">
          {mensagemErro}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:), não passa por next/image
        <img
          src={preview}
          alt="Comprovante capturado"
          className="max-h-80 w-full rounded-xl border border-neutral-200 object-contain"
        />
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500 transition active:bg-neutral-50"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-3xl">
            📷
          </span>
          <span className="font-medium">Toque para abrir a câmera</span>
        </button>
      )}

      {preview && (
        <Button variant="secondary" fullWidth onClick={() => inputRef.current?.click()}>
          Tirar outra foto
        </Button>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onVoltar}>
          Voltar
        </Button>
        <Button fullWidth disabled={!preview} onClick={onContinuar}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
