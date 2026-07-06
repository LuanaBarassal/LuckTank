"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconeOlho } from "@/components/ui/icone-olho";

type Estado = "verificando" | "pronto" | "invalido" | "concluido";

// O link de convite do Supabase (inviteUserByEmail) chega com
// access_token/refresh_token no HASH da URL (#...), nunca em query string —
// só o JavaScript no navegador consegue ler isso, por isso este componente
// tem que ser client e processar o hash no mount, antes de mostrar
// qualquer formulário. Sem esta página, o link de convite não tinha
// nenhum jeito de completar (achado real: convidarUsuario já existia desde
// a Fase 2, mas nunca tinha sido testado até o fim — "aceitar e definir
// senha" simplesmente não tinha código nenhum).
export default function DefinirSenhaForm() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function processarLink() {
      const supabase = createClient();
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        // Limpa o hash da URL (contém tokens sensíveis) assim que a sessão
        // é estabelecida — não deixa o token visível/copiável na barra de
        // endereço depois de usado.
        window.history.replaceState(null, "", window.location.pathname);
        if (error) {
          setEstado("invalido");
          return;
        }
        setEstado("pronto");
        return;
      }

      // Sem hash (ex.: usuário recarregou a página) — só segue se já
      // existir uma sessão válida de antes.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setEstado(user ? "pronto" : "invalido");
    }

    processarLink();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);

    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setEnviando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);

    if (error) {
      setErro("Não foi possível definir a senha. Tente pedir um novo convite.");
      return;
    }

    setEstado("concluido");
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  if (estado === "verificando") {
    return <p className="text-center text-sm text-neutral-500">Verificando o link...</p>;
  }

  if (estado === "invalido") {
    return (
      <div className="text-center">
        <h1 className="mb-2 font-title text-xl font-bold text-neutral-900">Link inválido ou expirado</h1>
        <p className="text-sm text-neutral-500">
          Peça pra quem te convidou enviar um novo convite — o link só funciona uma vez e expira
          depois de um tempo.
        </p>
      </div>
    );
  }

  if (estado === "concluido") {
    return (
      <div className="text-center">
        <h1 className="mb-2 font-title text-xl font-bold text-neutral-900">Senha definida!</h1>
        <p className="text-sm text-neutral-500">Redirecionando para o painel...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 font-title text-xl font-bold text-neutral-900">Defina sua senha</h1>
      <p className="mb-6 text-sm text-neutral-500">Escolha a senha que você vai usar pra entrar no LuckTank.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nova senha"
          type={mostrarSenha ? "text" : "password"}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
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
        <Input
          label="Confirmar senha"
          type={mostrarSenha ? "text" : "password"}
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          required
        />

        {erro && (
          <p className="rounded-lg bg-critico-50 px-3 py-2 text-sm font-medium text-critico-700">
            {erro}
          </p>
        )}

        <Button type="submit" fullWidth loading={enviando}>
          {enviando ? "Salvando..." : "Definir senha e entrar"}
        </Button>
      </form>
    </div>
  );
}
