"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  suspenderUsuario,
  suspenderEmpresa,
  excluirUsuario,
} from "@/app/(escritorio)/admin-sistema/actions";

export interface UsuarioEmpresaLinha {
  id: string;
  nome: string;
  email: string;
  papel: string;
  suspenso: boolean;
}

interface Props {
  empresaId: string;
  usuarios: UsuarioEmpresaLinha[];
}

export default function UsuariosEmpresaLista({ empresaId, usuarios }: Props) {
  const router = useRouter();
  const [carregando, setCarregando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSuspenderUsuario(usuarioId: string, suspender: boolean) {
    setErro(null);
    setCarregando(usuarioId);
    const resultado = await suspenderUsuario(usuarioId, suspender);
    setCarregando(null);
    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    router.refresh();
  }

  async function handleExcluir(usuarioId: string, email: string) {
    const confirmado = window.confirm(
      `Excluir de vez a conta de ${email}? Isso apaga o login (não dá pra desfazer). Se essa pessoa já editou/excluiu algo ou resolveu um alerta, a exclusão vai ser recusada pra não perder o rastro de auditoria — nesse caso, use "Suspender" em vez de excluir.`
    );
    if (!confirmado) return;

    setErro(null);
    setCarregando(usuarioId);
    const resultado = await excluirUsuario(usuarioId);
    setCarregando(null);
    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    router.refresh();
  }

  async function handleSuspenderEmpresa(suspender: boolean) {
    const confirmado = window.confirm(
      suspender
        ? "Suspender o acesso de TODOS os usuários desta empresa? Ninguém vai conseguir logar até você reativar."
        : "Reativar o acesso de todos os usuários desta empresa?"
    );
    if (!confirmado) return;

    setErro(null);
    setCarregando("__empresa__");
    const resultado = await suspenderEmpresa(empresaId, suspender);
    setCarregando(null);
    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    router.refresh();
  }

  if (usuarios.length === 0) {
    return <p className="text-xs text-slate-500">Nenhum usuário cadastrado nesta empresa ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {usuarios.map((usuario) => (
          <div
            key={usuario.id}
            className="flex flex-1 min-w-[220px] flex-col gap-1 rounded-lg border border-navy-800 bg-navy-950 p-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{usuario.nome}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  usuario.suspenso
                    ? "bg-critico-500/15 text-critico-400"
                    : "bg-sucesso-500/15 text-sucesso-400"
                }`}
              >
                {usuario.suspenso ? "Suspenso" : "Ativo"}
              </span>
            </div>
            <div className="text-xs text-slate-500">{usuario.email} · {usuario.papel}</div>
            <div className="mt-1 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={carregando === usuario.id}
                onClick={() => handleSuspenderUsuario(usuario.id, !usuario.suspenso)}
                className="text-xs font-semibold text-cyan-400 underline-offset-2 transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregando === usuario.id
                  ? "Aguarde..."
                  : usuario.suspenso
                    ? "Reativar acesso"
                    : "Suspender acesso"}
              </button>
              <button
                type="button"
                disabled={carregando === usuario.id}
                onClick={() => handleExcluir(usuario.id, usuario.email)}
                className="text-xs font-semibold text-critico-400 underline-offset-2 transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                Excluir conta
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 border-t border-navy-800 pt-2">
        <button
          type="button"
          disabled={carregando === "__empresa__"}
          onClick={() => handleSuspenderEmpresa(true)}
          className="text-xs font-semibold text-critico-400 underline-offset-2 transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          Suspender todos os acessos desta empresa
        </button>
        <button
          type="button"
          disabled={carregando === "__empresa__"}
          onClick={() => handleSuspenderEmpresa(false)}
          className="text-xs font-semibold text-sucesso-400 underline-offset-2 transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reativar todos os acessos desta empresa
        </button>
      </div>

      {erro && <p className="text-xs font-medium text-critico-400">{erro}</p>}
    </div>
  );
}
