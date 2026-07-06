"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarEmpresa } from "@/app/(escritorio)/admin-sistema/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CriarEmpresaForm() {
  const router = useRouter();
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nomeAdministrador, setNomeAdministrador] = useState("");
  const [emailAdministrador, setEmailAdministrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setSucesso(false);
    setEnviando(true);

    const resultado = await criarEmpresa({ nomeEmpresa, nomeAdministrador, emailAdministrador });

    setEnviando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    setNomeEmpresa("");
    setNomeAdministrador("");
    setEmailAdministrador("");
    setSucesso(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <Input
        label="Nome da empresa"
        placeholder="ex.: Transportes Horizonte"
        value={nomeEmpresa}
        onChange={(e) => setNomeEmpresa(e.target.value)}
        required
      />
      <Input
        label="Nome do administrador"
        value={nomeAdministrador}
        onChange={(e) => setNomeAdministrador(e.target.value)}
        required
      />
      <Input
        label="E-mail do administrador"
        type="email"
        value={emailAdministrador}
        onChange={(e) => setEmailAdministrador(e.target.value)}
        required
      />
      <p className="-mt-2 text-xs text-slate-500">
        O administrador recebe um convite por e-mail e define a própria senha ao aceitar —
        nenhuma senha é criada por aqui.
      </p>

      {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}
      {sucesso && (
        <p className="text-sm font-medium text-sucesso-400">
          Empresa criada e convite enviado com sucesso.
        </p>
      )}

      <Button type="submit" disabled={enviando}>
        {enviando ? "Criando..." : "Criar empresa"}
      </Button>
    </form>
  );
}
