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
  const inputCameraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFotoChange(event.target.files?.[0] ?? null);
    // Limpa o valor pra permitir escolher o mesmo arquivo de novo (ex.:
    // "tirar outra foto" e o celular reusar o mesmo nome de arquivo).
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-neutral-900">Foto do comprovante</h2>
      <p className="text-sm text-neutral-500">
        Tire uma foto legível do cupom/nota do abastecimento, ou escolha uma da galeria.
      </p>

      {mensagemErro && (
        <p className="rounded-lg bg-critico-50 px-3 py-2 text-sm font-medium text-critico-700">
          {mensagemErro}
        </p>
      )}

      {/* Dois inputs separados: `capture="environment"` força a câmera
          traseira; o segundo, sem `capture`, abre o seletor de arquivos/
          galeria do sistema. */}
      <input
        ref={inputCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={inputGaleriaRef}
        type="file"
        accept="image/*"
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
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => inputCameraRef.current?.click()}
            className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500 transition active:bg-neutral-50"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-3xl">
              📷
            </span>
            <span className="text-center font-medium">Tirar foto</span>
          </button>
          <button
            type="button"
            onClick={() => inputGaleriaRef.current?.click()}
            className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500 transition active:bg-neutral-50"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-3xl">
              🖼️
            </span>
            <span className="text-center font-medium">Escolher da galeria</span>
          </button>
        </div>
      )}

      {preview && (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" fullWidth onClick={() => inputCameraRef.current?.click()}>
            Tirar outra foto
          </Button>
          <Button variant="secondary" fullWidth onClick={() => inputGaleriaRef.current?.click()}>
            Escolher outra
          </Button>
        </div>
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
