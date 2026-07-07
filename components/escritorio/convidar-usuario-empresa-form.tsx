"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { convidarUsuarioParaEmpresa } from "@/app/(escritorio)/admin-sistema/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAPEIS } from "@/lib/validacao/schemas";

interface Props {
  empresas: { id: string; nome: string }[];
}

export default function ConvidarUsuarioEmpresaForm({ empresas }: Props) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<string>("supervisor");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setSucesso(false);

    if (!empresaId) {
      setErro("Selecione uma empresa.");
      return;
    }

    setEnviando(true);
    const resultado = await convidarUsuarioParaEmpresa(empresaId, { nome, email, papel });
    setEnviando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    setSucesso(true);
    setNome("");
    setEmail("");
    setPapel("supervisor");
    router.refresh();
  }

  if (empresas.length === 0) {
    return <p className="text-sm text-slate-400">Cadastre uma empresa antes de convidar usuários.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-300" htmlFor="empresa_convite">
          Empresa
        </label>
        <select
          id="empresa_convite"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          className="min-h-touch rounded-xl border border-navy-700 bg-navy-800 px-4 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
        >
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nome}
            </option>
          ))}
        </select>
      </div>

      <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      <Input
        label="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-300" htmlFor="papel_convite">
          Papel
        </label>
        <select
          id="papel_convite"
          value={papel}
          onChange={(e) => setPapel(e.target.value)}
          className="min-h-touch rounded-xl border border-navy-700 bg-navy-800 px-4 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}
      {sucesso && <p className="text-sm font-medium text-sucesso-400">Convite enviado.</p>}

      <Button type="submit" disabled={enviando}>
        {enviando ? "Enviando..." : "Convidar usuário"}
      </Button>
    </form>
  );
}
