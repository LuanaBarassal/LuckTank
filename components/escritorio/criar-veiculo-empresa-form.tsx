"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarVeiculoParaEmpresa } from "@/app/(escritorio)/admin-sistema/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TIPOS_COMBUSTIVEL, ROTULO_TIPO_COMBUSTIVEL } from "@/lib/validacao/schemas";

interface Props {
  empresas: { id: string; nome: string }[];
}

// Mesmos campos de VeiculoForm (components/escritorio/veiculo-form.tsx), sem
// upload de foto — ver comentário em criarVeiculoParaEmpresa (a action) sobre
// por quê. Se o cliente quiser foto, edita o veículo depois pela própria
// empresa (edição continua liberada pra gerente/administrador).
export default function CriarVeiculoEmpresaForm({ empresas }: Props) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [prefixo, setPrefixo] = useState("");
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [marca, setMarca] = useState("");
  const [ano, setAno] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [consumoReferencia, setConsumoReferencia] = useState("");
  const [tipoCombustivel, setTipoCombustivel] = useState("");
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
    const resultado = await criarVeiculoParaEmpresa(empresaId, {
      placa,
      prefixo: prefixo || null,
      modelo,
      marca,
      ano: ano ? Number(ano) : null,
      capacidade_tanque_litros: capacidade ? Number(capacidade) : null,
      consumo_referencia_kml: consumoReferencia ? Number(consumoReferencia) : null,
      tipo_combustivel: tipoCombustivel || null,
    });
    setEnviando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    setSucesso(true);
    setPrefixo("");
    setPlaca("");
    setModelo("");
    setMarca("");
    setAno("");
    setCapacidade("");
    setConsumoReferencia("");
    setTipoCombustivel("");
    router.refresh();
  }

  if (empresas.length === 0) {
    return <p className="text-sm text-slate-400">Cadastre uma empresa antes de cadastrar veículos.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-300" htmlFor="empresa_veiculo">
          Empresa
        </label>
        <select
          id="empresa_veiculo"
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

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Prefixo"
          placeholder="ex.: 1450"
          value={prefixo}
          onChange={(e) => setPrefixo(e.target.value)}
        />
        <Input label="Placa" value={placa} onChange={(e) => setPlaca(e.target.value)} required />
      </div>

      <Input label="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
      <Input label="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
      <Input label="Ano" type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
      <Input
        label="Capacidade do tanque (litros)"
        type="number"
        value={capacidade}
        onChange={(e) => setCapacidade(e.target.value)}
      />
      <Input
        label="Consumo de referência (km/L)"
        type="number"
        step="0.1"
        placeholder="ex.: 3.5"
        value={consumoReferencia}
        onChange={(e) => setConsumoReferencia(e.target.value)}
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-300" htmlFor="tipo_combustivel_veiculo">
          Tipo de combustível
        </label>
        <select
          id="tipo_combustivel_veiculo"
          value={tipoCombustivel}
          onChange={(e) => setTipoCombustivel(e.target.value)}
          className="min-h-touch rounded-xl border border-navy-700 bg-navy-800 px-4 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
        >
          <option value="">Selecione…</option>
          {TIPOS_COMBUSTIVEL.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ROTULO_TIPO_COMBUSTIVEL[tipo]}
            </option>
          ))}
        </select>
      </div>

      {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}
      {sucesso && <p className="text-sm font-medium text-sucesso-400">Veículo cadastrado.</p>}

      <Button type="submit" disabled={enviando}>
        {enviando ? "Cadastrando..." : "Cadastrar veículo"}
      </Button>
    </form>
  );
}
