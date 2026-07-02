"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Motorista {
  id: string;
  nome: string;
}

interface Props {
  motoristas: Motorista[];
  motoristaId: string | null;
  usarNomeLivre: boolean;
  nomeLivre: string;
  onSelecionar: (id: string) => void;
  onUsarNomeLivre: () => void;
  onNomeLivreChange: (valor: string) => void;
  onContinuar: () => void;
}

export default function PassoNome({
  motoristas,
  motoristaId,
  usarNomeLivre,
  nomeLivre,
  onSelecionar,
  onUsarNomeLivre,
  onNomeLivreChange,
  onContinuar,
}: Props) {
  const podeContinuar = usarNomeLivre ? nomeLivre.trim().length >= 2 : Boolean(motoristaId);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-neutral-900">Quem está abastecendo?</h2>

      <div className="flex flex-col gap-2">
        {motoristas.map((motorista) => (
          <button
            key={motorista.id}
            type="button"
            onClick={() => onSelecionar(motorista.id)}
            className={cn(
              "min-h-touch rounded-xl border-2 px-4 text-left text-base font-medium transition",
              !usarNomeLivre && motoristaId === motorista.id
                ? "border-primary-600 bg-primary-50 text-primary-800"
                : "border-neutral-200 bg-white text-neutral-900"
            )}
          >
            {motorista.nome}
          </button>
        ))}

        <button
          type="button"
          onClick={onUsarNomeLivre}
          className={cn(
            "min-h-touch rounded-xl border-2 border-dashed px-4 text-left text-base font-medium transition",
            usarNomeLivre
              ? "border-primary-600 bg-primary-50 text-primary-800"
              : "border-neutral-300 text-neutral-500"
          )}
        >
          Meu nome não está na lista
        </button>
      </div>

      {usarNomeLivre && (
        <Input
          label="Seu nome completo"
          value={nomeLivre}
          onChange={(e) => onNomeLivreChange(e.target.value)}
          placeholder="Digite seu nome"
          autoFocus
        />
      )}

      <Button fullWidth disabled={!podeContinuar} onClick={onContinuar}>
        Continuar
      </Button>
    </div>
  );
}
