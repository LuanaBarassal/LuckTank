"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    setCarregando(false);

    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }

    const redirectTo = searchParams.get("redirectTo") || "/dashboard";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl"
      >
        <h1 className="mb-1 text-2xl font-semibold text-white">LuckTank</h1>
        <p className="mb-6 text-sm text-slate-400">Acesso do escritório</p>

        <label className="mb-1 block text-sm text-slate-300" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
        />

        <label className="mb-1 block text-sm text-slate-300" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
        />

        {erro && <p className="mb-4 text-sm text-red-400">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-md bg-emerald-600 py-2 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
