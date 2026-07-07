"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FORMAS_PAGAMENTO, ROTULO_FORMA_PAGAMENTO } from "@/lib/validacao/schemas";
import { formatarMoeda } from "@/lib/formatacao";

export interface ValoresFormulario {
  dataAbastecimento: string;
  hora: string;
  postoNome: string;
  postoCidade: string;
  postoUf: string;
  postoCnpj: string;
  litros: string;
  valorTotal: string;
  formaPagamento: string;
  numeroNota: string;
  bandeiraPosto: string;
  kmAtual: string;
}

interface Props {
  valores: ValoresFormulario;
  onChange: <K extends keyof ValoresFormulario>(campo: K, valor: string) => void;
  kmMinimo: number | null;
  erro: string | null;
  aviso?: string | null;
  enviando: boolean;
  onVoltar: () => void;
  onSubmit: () => void;
}

export default function PassoFormulario({
  valores,
  onChange,
  kmMinimo,
  erro,
  aviso,
  enviando,
  onVoltar,
  onSubmit,
}: Props) {
  const kmMenorQueAnterior =
    kmMinimo != null && valores.kmAtual !== "" && Number(valores.kmAtual) < kmMinimo;

  // Derivado (não é um campo próprio, nunca gravado): sempre a divisão dos
  // dois campos que já existem, então nunca diverge do que a IA leu nem do
  // que o motorista está digitando agora — inclusive se ele corrigir litros
  // ou valor total manualmente, o valor por litro acompanha em tempo real.
  const litrosNumero = Number(valores.litros);
  const valorTotalNumero = Number(valores.valorTotal);
  const valorPorLitro =
    litrosNumero > 0 && valorTotalNumero > 0 ? valorTotalNumero / litrosNumero : null;

  const podeEnviar =
    valores.dataAbastecimento.length > 0 &&
    Number(valores.litros) > 0 &&
    Number(valores.valorTotal) > 0 &&
    Number(valores.kmAtual) > 0 &&
    !kmMenorQueAnterior &&
    !enviando;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-neutral-900">Dados do abastecimento</h2>

      {aviso && (
        <p className="rounded-lg bg-atencao-50 px-3 py-2 text-sm font-medium text-atencao-700">
          {aviso}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Data"
          type="date"
          value={valores.dataAbastecimento}
          onChange={(e) => onChange("dataAbastecimento", e.target.value)}
          required
        />
        <Input
          label="Hora (opcional)"
          type="time"
          value={valores.hora}
          onChange={(e) => onChange("hora", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Litros"
          type="number"
          inputMode="decimal"
          step="0.01"
          value={valores.litros}
          onChange={(e) => onChange("litros", e.target.value)}
          required
        />
        <Input
          label="Valor total (R$)"
          type="number"
          inputMode="decimal"
          step="0.01"
          value={valores.valorTotal}
          onChange={(e) => onChange("valorTotal", e.target.value)}
          required
        />
      </div>

      {valorPorLitro != null && (
        <p className="-mt-2 text-xs text-neutral-500">
          Valor por litro: {formatarMoeda(valorPorLitro)}/L
        </p>
      )}

      <div>
        <Input
          label="KM atual do veículo"
          type="number"
          inputMode="numeric"
          step="1"
          value={valores.kmAtual}
          onChange={(e) => onChange("kmAtual", e.target.value)}
          error={kmMenorQueAnterior ? `KM não pode ser menor que ${kmMinimo}` : undefined}
          required
        />
      </div>

      <Input
        label="Posto (opcional)"
        value={valores.postoNome}
        onChange={(e) => onChange("postoNome", e.target.value)}
      />

      <div className="grid grid-cols-[1fr_80px] gap-3">
        <Input
          label="Cidade (opcional)"
          value={valores.postoCidade}
          onChange={(e) => onChange("postoCidade", e.target.value)}
        />
        <Input
          label="UF"
          maxLength={2}
          value={valores.postoUf}
          onChange={(e) => onChange("postoUf", e.target.value.toUpperCase())}
        />
      </div>

      <Input
        label="CNPJ do posto (opcional)"
        value={valores.postoCnpj}
        onChange={(e) => onChange("postoCnpj", e.target.value)}
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-neutral-700" htmlFor="forma_pagamento">
          Forma de pagamento (opcional)
        </label>
        <select
          id="forma_pagamento"
          value={valores.formaPagamento}
          onChange={(e) => onChange("formaPagamento", e.target.value)}
          className="min-h-touch rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        >
          <option value="">Selecione…</option>
          {FORMAS_PAGAMENTO.map((forma) => (
            <option key={forma} value={forma}>
              {ROTULO_FORMA_PAGAMENTO[forma]}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Número da nota (opcional)"
        value={valores.numeroNota}
        onChange={(e) => onChange("numeroNota", e.target.value)}
      />

      <Input
        label="Bandeira do posto (opcional)"
        value={valores.bandeiraPosto}
        onChange={(e) => onChange("bandeiraPosto", e.target.value)}
        placeholder="Ex: Shell, Ipiranga, Petrobras..."
      />

      {erro && (
        <p className="rounded-lg bg-critico-50 px-3 py-2 text-sm font-medium text-critico-700">
          {erro}
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onVoltar} disabled={enviando}>
          Voltar
        </Button>
        <Button fullWidth disabled={!podeEnviar} loading={enviando} onClick={onSubmit}>
          {enviando ? "Enviando..." : "Confirmar abastecimento"}
        </Button>
      </div>
    </div>
  );
}
