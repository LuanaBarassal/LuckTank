"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
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
    <main className="flex min-h-screen bg-white">
      {/* Painel de marca — só em telas largas, isto aqui é o escritório */}
      <div className="relative hidden w-2/5 overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-700 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-400" />
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-cyan-600" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-lg font-bold text-navy-950 shadow-glow-cyan">
            LT
          </div>
          <span className="font-title text-2xl font-bold text-white">LuckTank</span>
        </div>

        <div className="relative z-10">
          <h2 className="font-title text-3xl font-bold leading-tight text-white">
            Controle de combustível
            <br />e anti-fraude pra sua frota.
          </h2>
          <p className="mt-4 max-w-sm text-slate-300">
            Cada abastecimento registrado, conferido e auditável — do posto ao
            escritório, sem planilha.
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-navy-800 to-cyan-600 text-base font-bold text-white shadow-glow-cyan">
              LT
            </div>
            <span className="font-title text-xl font-bold text-navy-900">LuckTank</span>
          </div>

          <h1 className="font-title text-2xl font-bold text-neutral-900">Acesso do escritório</h1>
          <p className="mb-6 text-sm text-neutral-500">Entre com seu e-mail e senha.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="E-mail"
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Senha"
              id="senha"
              type={mostrarSenha ? "text" : "password"}
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              endAdornment={
                <button
                  type="button"
                  onClick={() => setMostrarSenha((atual) => !atual)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={mostrarSenha}
                  className="flex h-11 w-11 items-center justify-center text-neutral-400 transition hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                >
                  <IconeOlho aberto={mostrarSenha} />
                </button>
              }
            />

            {erro && (
              <p className="rounded-lg bg-critico-50 px-3 py-2 text-sm font-medium text-critico-700">
                {erro}
              </p>
            )}

            <Button type="submit" fullWidth loading={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

// Ícones mínimos desenhados à mão (sem lib de ícone no projeto) — "olho"
// (senha visível) e "olho cortado" (senha oculta), 20x20, herdam a cor via
// `currentColor` pra seguir o hover/focus do botão que os envolve.
function IconeOlho({ aberto }: { aberto: boolean }) {
  if (aberto) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2.5 12s3.75-7 9.5-7 9.5 7 9.5 7-3.75 7-9.5 7-9.5-7-9.5-7Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 3.5l17 17M6.6 6.9C4.4 8.4 2.5 12 2.5 12s3.75 7 9.5 7c1.9 0 3.55-.55 4.9-1.35M10.6 10.6a3 3 0 0 0 4.24 4.24M9.9 5.2A9.7 9.7 0 0 1 12 5c5.75 0 9.5 7 9.5 7-.5.9-1.35 2.15-2.55 3.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
