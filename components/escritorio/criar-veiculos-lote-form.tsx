"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarVeiculosEmLote, type ErroLinhaLote } from "@/app/(escritorio)/admin-sistema/actions";
import { Button } from "@/components/ui/button";

interface Props {
  empresas: { id: string; nome: string }[];
}

// Cola uma linha por veículo (placa, prefixo, modelo, marca, ano — TAB ou
// vírgula entre os campos, exatamente o que sai ao copiar células do
// Excel/Google Sheets e colar num campo de texto). Campos além da placa
// são opcionais; ano/tanque/combustível detalhados ficam pro cadastro
// individual depois.
export default function CriarVeiculosLoteForm({ empresas }: Props) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ criados: number; erros: ErroLinhaLote[] } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setResultado(null);

    if (!empresaId) {
      setErro("Selecione uma empresa.");
      return;
    }

    setEnviando(true);
    const resposta = await criarVeiculosEmLote(empresaId, texto);
    setEnviando(false);

    if (resposta.error || !resposta.data) {
      setErro(resposta.error ?? "Não foi possível cadastrar.");
      return;
    }

    setResultado(resposta.data);
    if (resposta.data.erros.length === 0) setTexto("");
    router.refresh();
  }

  if (empresas.length === 0) {
    return <p className="text-sm text-slate-400">Cadastre uma empresa antes de cadastrar veículos.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-300" htmlFor="empresa_lote">
          Empresa
        </label>
        <select
          id="empresa_lote"
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

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-300" htmlFor="lote_texto">
          Uma linha por veículo — placa, prefixo, modelo, marca, ano
        </label>
        <textarea
          id="lote_texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          placeholder={"EXM1A23\t1450\tParadiso 1200 G7\tMarcopolo\t2022\nEXM1B45\t1451\t17.230 OD\tVolkswagen\t2020"}
          className="rounded-xl border border-navy-700 bg-navy-800 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
        />
        <p className="text-xs text-slate-500">
          Cole direto de uma planilha (Excel/Google Sheets) — só a placa é obrigatória, o resto pode
          ficar em branco. Capacidade de tanque, combustível e consumo de referência entram depois,
          no cadastro individual.
        </p>
      </div>

      {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}

      {resultado && (
        <div className="rounded-xl border border-navy-700 bg-navy-800 p-3 text-sm">
          <p className="font-medium text-sucesso-400">{resultado.criados} veículo(s) cadastrado(s).</p>
          {resultado.erros.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {resultado.erros.map((e) => (
                <li key={e.linha} className="text-critico-400">
                  Linha {e.linha} (&ldquo;{e.texto}&rdquo;): {e.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button type="submit" disabled={enviando || !texto.trim()}>
        {enviando ? "Cadastrando..." : "Cadastrar em lote"}
      </Button>
    </form>
  );
}
