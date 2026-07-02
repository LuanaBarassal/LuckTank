"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  dados: Array<Record<string, string | number>>;
  chaveX: string;
  chaveY: string;
  corBarra?: string;
  formatarY?: (valor: number) => string;
}

// Um único componente reutilizável pra todos os gráficos do dashboard —
// todos são "uma série, barras verticais", só muda a chave/cor.
export default function GraficoBarra({
  dados,
  chaveX,
  chaveY,
  corBarra = "#16a34a",
  formatarY,
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={dados} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey={chaveX} stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={formatarY} width={48} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          labelStyle={{ color: "#e2e8f0" }}
          itemStyle={{ color: corBarra }}
        />
        <Bar dataKey={chaveY} fill={corBarra} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
