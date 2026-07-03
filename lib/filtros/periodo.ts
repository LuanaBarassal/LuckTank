// Cálculo dos atalhos de período do filtro do dashboard/aba do ônibus —
// função pura (sem Date.now() implícito, sempre recebe `agora` como
// parâmetro opcional) pra ficar testável determinística, mesmo padrão de
// lib/validacao/regras.ts. Trabalha inteiramente em UTC (Date.UTC +
// getUTC*/toISOString) pra não misturar duas fontes de fuso horário na
// mesma conta — consistente com o resto do app, que já trata datas como
// string "YYYY-MM-DD" comparada lexicamente contra a coluna `date` do
// Postgres (ver lib/formatacao.ts).

export type AtalhoPeriodo = "hoje" | "7dias" | "esteMes" | "mesPassado";

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function calcularPeriodo(
  atalho: AtalhoPeriodo,
  agora: Date = new Date()
): { de: string; ate: string } {
  const hoje = paraIso(agora);

  switch (atalho) {
    case "hoje":
      return { de: hoje, ate: hoje };
    case "7dias": {
      const inicio = new Date(agora);
      inicio.setUTCDate(inicio.getUTCDate() - 6); // inclui hoje = 7 dias no total
      return { de: paraIso(inicio), ate: hoje };
    }
    case "esteMes": {
      const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
      return { de: paraIso(inicio), ate: hoje };
    }
    case "mesPassado": {
      const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1));
      const fim = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 0)); // dia 0 = último dia do mês anterior
      return { de: paraIso(inicio), ate: paraIso(fim) };
    }
  }
}
