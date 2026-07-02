"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolverAlerta } from "@/app/(escritorio)/alertas/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const ROTULO_NIVEL: Record<string, string> = {
  info: "Info",
  atencao: "Atenção",
  critico: "Crítico",
};

const CLASSE_NIVEL: Record<string, string> = {
  info: "bg-slate-700 text-slate-200",
  atencao: "bg-amber-500/20 text-amber-400",
  critico: "bg-red-500/20 text-red-400",
};

const ROTULO_REGRA: Record<string, string> = {
  litros_acima_capacidade_tanque: "Litros acima da capacidade do tanque",
  nota_fiscal_duplicada: "Nota fiscal duplicada",
  foto_comprovante_duplicada: "Foto do comprovante duplicada",
  consumo_fora_da_faixa_historica: "Consumo fora da faixa histórica",
  litros_desproporcionais_ao_km_rodado: "Litros desproporcionais ao KM rodado",
};

export interface AlertaComContexto {
  id: string;
  tipo_regra: string;
  nivel: "info" | "atencao" | "critico";
  detalhes: Record<string, unknown> | null;
  resolvido: boolean;
  criado_em: string;
  veiculoPlaca: string | null;
  abastecimentoData: string | null;
}

export default function ListaAlertas({ alertas }: { alertas: AlertaComContexto[] }) {
  const pendentes = alertas.filter((a) => !a.resolvido);
  const resolvidos = alertas.filter((a) => a.resolvido);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Pendentes ({pendentes.length})
        </h2>
        {pendentes.length === 0 ? (
          <Card className="bg-slate-900 text-slate-100">
            <p className="text-sm text-neutral-400">Nenhum alerta pendente.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {pendentes.map((alerta) => (
              <ItemAlerta key={alerta.id} alerta={alerta} />
            ))}
          </div>
        )}
      </div>

      {resolvidos.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Resolvidos ({resolvidos.length})
          </h2>
          <div className="flex flex-col gap-3">
            {resolvidos.map((alerta) => (
              <ItemAlerta key={alerta.id} alerta={alerta} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemAlerta({ alerta }: { alerta: AlertaComContexto }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  async function handleResolver() {
    setEnviando(true);
    await resolverAlerta(alerta.id);
    setEnviando(false);
    router.refresh();
  }

  return (
    <Card className="bg-slate-900 text-slate-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASSE_NIVEL[alerta.nivel]}`}
            >
              {ROTULO_NIVEL[alerta.nivel]}
            </span>
            <span className="font-medium">
              {ROTULO_REGRA[alerta.tipo_regra] ?? alerta.tipo_regra}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {alerta.veiculoPlaca ?? "Veículo não encontrado"}
            {alerta.abastecimentoData ? ` · ${alerta.abastecimentoData}` : ""}
          </p>
          {alerta.detalhes && (
            <p className="mt-1 text-xs text-slate-500">
              {Object.entries(alerta.detalhes)
                .map(([chave, valor]) => `${chave}: ${valor}`)
                .join(" · ")}
            </p>
          )}
        </div>
        {!alerta.resolvido && (
          <Button variant="outline" onClick={handleResolver} disabled={enviando}>
            {enviando ? "..." : "Resolver"}
          </Button>
        )}
      </div>
    </Card>
  );
}
