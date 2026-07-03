"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarMotorista, atualizarMotorista } from "@/app/(escritorio)/motoristas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MotoristaExistente {
  id: string;
  nome: string;
  cpf: string | null;
}

export default function MotoristaForm({ motorista }: { motorista?: MotoristaExistente }) {
  const router = useRouter();
  const [nome, setNome] = useState(motorista?.nome ?? "");
  const [cpf, setCpf] = useState(motorista?.cpf ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    const payload = { nome, cpf };
    const resultado = motorista
      ? await atualizarMotorista(motorista.id, payload)
      : await criarMotorista(payload);

    setEnviando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    router.push("/motoristas");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      <Input
        label="CPF (opcional)"
        value={cpf ?? ""}
        onChange={(e) => setCpf(e.target.value)}
        placeholder="Somente números"
      />
      {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}
      <Button type="submit" disabled={enviando}>
        {enviando ? "Salvando..." : motorista ? "Salvar alterações" : "Cadastrar motorista"}
      </Button>
    </form>
  );
}
