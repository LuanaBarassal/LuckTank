"use client";

import { useState, type FormEvent } from "react";
import { solicitarRecuperacaoSenha } from "@/lib/auth/sessao-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Ponto de entrada do fluxo self-service — o resto (estabelecer sessão a
// partir do link, trocar a senha) já existia e é o mesmo usado pelo
// convite (components/escritorio/definir-senha-form.tsx). Este componente
// só cuida do PRIMEIRO passo: pedir o e-mail e mostrar a mensagem
// genérica (nunca "e-mail não encontrado" nem nada que diferencie conta
// existente de inexistente — ver solicitarRecuperacaoSenha).
export default function EsqueciSenhaForm() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setEnviando(true);
    const resultado = await solicitarRecuperacaoSenha(email);
    setEnviando(false);
    setMensagem(resultado.mensagem);
  }

  if (mensagem) {
    return (
      <div className="text-center">
        <h1 className="mb-2 font-title text-xl font-bold text-neutral-900">Verifique seu e-mail</h1>
        <p className="text-sm text-neutral-500">{mensagem}</p>
        <a
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-cyan-700 underline-offset-2 hover:underline"
        >
          Voltar pro login
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 font-title text-xl font-bold text-neutral-900">Esqueceu sua senha?</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Informe o e-mail da sua conta — se estiver cadastrado, enviamos um link pra você escolher
        uma senha nova.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="E-mail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button type="submit" fullWidth loading={enviando}>
          {enviando ? "Enviando..." : "Enviar link de recuperação"}
        </Button>
      </form>

      <a
        href="/login"
        className="mt-6 block text-center text-sm font-medium text-neutral-500 underline-offset-2 hover:underline"
      >
        Voltar pro login
      </a>
    </div>
  );
}
