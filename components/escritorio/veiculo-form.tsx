"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { criarVeiculo, atualizarVeiculo } from "@/app/(escritorio)/onibus/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TIPOS_COMBUSTIVEL, ROTULO_TIPO_COMBUSTIVEL } from "@/lib/validacao/schemas";

interface VeiculoExistente {
  id: string;
  placa: string;
  prefixo: string | null;
  modelo: string | null;
  marca: string | null;
  ano: number | null;
  capacidade_tanque_litros: number | null;
  tipo_combustivel: string | null;
  foto_url: string | null;
}

interface VeiculoFormProps {
  empresaId: string;
  veiculo?: VeiculoExistente;
}

export default function VeiculoForm({ empresaId, veiculo }: VeiculoFormProps) {
  const router = useRouter();
  const [prefixo, setPrefixo] = useState(veiculo?.prefixo ?? "");
  const [placa, setPlaca] = useState(veiculo?.placa ?? "");
  const [modelo, setModelo] = useState(veiculo?.modelo ?? "");
  const [marca, setMarca] = useState(veiculo?.marca ?? "");
  const [ano, setAno] = useState(veiculo?.ano?.toString() ?? "");
  const [capacidade, setCapacidade] = useState(
    veiculo?.capacidade_tanque_litros?.toString() ?? ""
  );
  const [tipoCombustivel, setTipoCombustivel] = useState(veiculo?.tipo_combustivel ?? "");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoUrlAtual] = useState(veiculo?.foto_url ?? null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function handleFotoChange(event: ChangeEvent<HTMLInputElement>) {
    setFotoFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    let fotoUrl = fotoUrlAtual;

    if (fotoFile) {
      const supabase = createClient();
      const caminho = `${empresaId}/${veiculo?.id ?? crypto.randomUUID()}/${Date.now()}-${fotoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("fotos-veiculos")
        .upload(caminho, fotoFile, { upsert: true });

      if (uploadError) {
        setErro("Não foi possível enviar a foto.");
        setEnviando(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("fotos-veiculos").getPublicUrl(caminho);
      fotoUrl = publicUrlData.publicUrl;
    }

    const payload = {
      placa,
      prefixo: prefixo || null,
      modelo,
      marca,
      ano: ano ? Number(ano) : null,
      capacidade_tanque_litros: capacidade ? Number(capacidade) : null,
      tipo_combustivel: tipoCombustivel || null,
      foto_url: fotoUrl,
    };

    const resultado = veiculo
      ? await atualizarVeiculo(veiculo.id, payload)
      : await criarVeiculo(payload);

    setEnviando(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    router.push("/onibus");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Prefixo"
          placeholder="ex.: 1450"
          value={prefixo}
          onChange={(e) => setPrefixo(e.target.value)}
        />
        <Input label="Placa" value={placa} onChange={(e) => setPlaca(e.target.value)} required />
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Prefixo é o identificador usado na operação (motorista e escritório se referem ao ônibus por
        ele) — opcional, mas recomendado.
      </p>
      <Input label="Modelo" value={modelo ?? ""} onChange={(e) => setModelo(e.target.value)} />
      <Input label="Marca" value={marca ?? ""} onChange={(e) => setMarca(e.target.value)} />
      <Input label="Ano" type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
      <Input
        label="Capacidade do tanque (litros)"
        type="number"
        value={capacidade}
        onChange={(e) => setCapacidade(e.target.value)}
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-300" htmlFor="tipo_combustivel">
          Tipo de combustível
        </label>
        <select
          id="tipo_combustivel"
          value={tipoCombustivel ?? ""}
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

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-300" htmlFor="foto">
          Foto (opcional)
        </label>
        <input
          id="foto"
          type="file"
          accept="image/*"
          onChange={handleFotoChange}
          className="text-sm text-slate-300"
        />
        {fotoUrlAtual && !fotoFile && (
          // eslint-disable-next-line @next/next/no-img-element -- vem do Storage, não precisa de next/image
          <img
            src={fotoUrlAtual}
            alt="Foto atual do veículo"
            className="mt-2 h-24 w-24 rounded-lg object-cover"
          />
        )}
      </div>

      {erro && <p className="text-sm font-medium text-critico-400">{erro}</p>}

      <Button type="submit" disabled={enviando}>
        {enviando ? "Salvando..." : veiculo ? "Salvar alterações" : "Cadastrar veículo"}
      </Button>
    </form>
  );
}
