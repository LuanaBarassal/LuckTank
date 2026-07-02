"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { convidarUsuario } from "@/app/(escritorio)/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAPEIS } from "@/lib/validacao/schemas";

export default function ConvidarUsuarioForm() {
  const router = useRouter();
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
    setEnviando(true);

    const resultado = await convidarUsuario({ nome, email, papel });
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

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      <Input
        label="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-neutral-300" htmlFor="papel">
          Papel
        </label>
        <select
          id="papel"
          value={papel}
          onChange={(e) => setPapel(e.target.value)}
          className="min-h-touch rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-base text-white outline-none focus:border-primary-500"
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      {sucesso && <p className="text-sm text-primary-400">Convite enviado.</p>}
      <Button type="submit" disabled={enviando}>
        {enviando ? "Enviando..." : "Convidar"}
      </Button>
    </form>
  );
}
