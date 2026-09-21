"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  confirmarMatriculaMfa,
  desmatricularMfa,
  iniciarMatriculaMfa,
  type FatorMfa,
} from "@/lib/auth/mfa";
import { Button } from "@/components/ui/button";

// Ativação/remoção de MFA (TOTP) — self-service, mesmo padrão de PinForm.
// `fatorVerificado` vem do servidor (Configuracoes/page.tsx); depois de
// qualquer mutação, `router.refresh()` busca o estado atualizado de novo
// (não guarda o "está ativo" só em estado local, pra nunca divergir do que
// o Supabase realmente tem matriculado).
export default function MfaForm({ fatorVerificado }: { fatorVerificado: FatorMfa | null }) {
  const router = useRouter();
  const [matricula, setMatricula] = useState<{
    factorId: string;
    qrCodeSvg: string;
    segredo: string;
  } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleIniciar() {
    setErro(null);
    setCarregando(true);
    const resultado = await iniciarMatriculaMfa();
    setCarregando(false);

    if (!resultado.data) {
      setErro(resultado.error ?? "Não foi possível iniciar a matrícula de MFA.");
      return;
    }
    setMatricula(resultado.data);
  }

  async function handleConfirmar(event: FormEvent) {
    event.preventDefault();
    if (!matricula) return;

    setErro(null);
    setCarregando(true);
    const resultado = await confirmarMatriculaMfa(matricula.factorId, codigo);
    setCarregando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    setMatricula(null);
    setCodigo("");
    router.refresh();
  }

  async function handleRemover() {
    if (!fatorVerificado) return;
    setErro(null);
    setCarregando(true);
    const resultado = await desmatricularMfa(fatorVerificado.id);
    setCarregando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    router.refresh();
  }

  if (fatorVerificado) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-sucesso-400">
          Verificação em duas etapas ativada.
        </p>
        {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}
        <Button variant="outline" onClick={handleRemover} loading={carregando} className="self-start">
          Desativar
        </Button>
      </div>
    );
  }

  if (matricula) {
    return (
      <form onSubmit={handleConfirmar} className="flex flex-col gap-4">
        <p className="text-sm text-slate-400">
          Escaneie o QR code com seu aplicativo autenticador (Google Authenticator, Authy, 1Password
          etc.) e digite o código de 6 dígitos gerado.
        </p>
        <div
          className="w-fit rounded-xl bg-white p-3"
          // SVG vem direto da API do Supabase (não é entrada de usuário) — ver lib/auth/mfa.ts.
          dangerouslySetInnerHTML={{ __html: matricula.qrCodeSvg }}
        />
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none">Não consegue escanear? Digitar manualmente</summary>
          <p className="mt-1 break-all font-mono">{matricula.segredo}</p>
        </details>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-300" htmlFor="mfa-codigo">
            Código do autenticador
          </label>
          <input
            id="mfa-codigo"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="min-h-touch w-40 rounded-xl border border-navy-700 bg-navy-800 px-4 text-center text-lg tracking-[0.4em] text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>
        {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={carregando || codigo.length !== 6} loading={carregando}>
            Confirmar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMatricula(null);
              setCodigo("");
              setErro(null);
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}
      <Button onClick={handleIniciar} loading={carregando} className="self-start">
        Ativar verificação em duas etapas
      </Button>
    </div>
  );
}
