"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";

// Usa <input type=file capture> em vez de getUserMedia: abre a câmera nativa do
// celular direto (sem pedir permissão de stream de vídeo), que é o que o fluxo
// real do motorista vai usar na Fase 3/4 pra fotografar o comprovante.
export default function CameraTeste() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      <Button type="button" onClick={() => inputRef.current?.click()}>
        Testar câmera
      </Button>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image não se aplica
        <img
          src={preview}
          alt="Foto capturada no teste de câmera"
          className="h-40 w-40 rounded-xl border border-neutral-200 object-cover"
        />
      )}
    </div>
  );
}
