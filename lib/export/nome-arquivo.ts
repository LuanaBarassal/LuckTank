// Nome do arquivo de export — função pura, mesmo padrão de
// lib/filtros/periodo.ts: sempre "LuckTank_<segmento1>_<segmento2>..._<período>.<ext>".
// `segmentos` é a identidade do relatório — `[empresaNome]` no export geral
// do dashboard, `[prefixo, placa]` no export de dentro da aba de um ônibus
// específico (cada segmento é limpo/slugificado separadamente e junto por
// "_", em vez de virar uma coisa só, pra manter "1450" e "EXM1A23"
// legíveis e separados no nome do arquivo). Período vira "YYYY-MM" quando o
// filtro cobre um mês corrido inteiro (o caso mais comum — relatório
// mensal), senão "YYYY-MM-DD_a_YYYY-MM-DD".

// Mesmo padrão de remoção de acento usado em
// components/motorista/fluxo-abastecimento.tsx (mapearFormaPagamento) —
// precisa do "target": "ES2018" no tsconfig pra flag `u` de regex funcionar
// com \p{Diacritic} (ver "Lições aprendidas" no PROJETO.md, Fase 4).
function normalizarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "");
}

function ehMesCorridoInteiro(de: string, ate: string): boolean {
  const [anoDe, mesDe, diaDe] = de.split("-").map(Number);
  const [anoAte, mesAte, diaAte] = ate.split("-").map(Number);
  if (anoDe !== anoAte || mesDe !== mesAte) return false;
  if (diaDe !== 1) return false;

  const ultimoDiaDoMes = new Date(Date.UTC(anoDe, mesDe, 0)).getUTCDate();
  return diaAte === ultimoDiaDoMes;
}

export function gerarNomeArquivoExport(
  segmentos: string[],
  periodo: { de: string; ate: string },
  extensao: "xlsx" | "pdf"
): string {
  const partes = segmentos.map(normalizarSlug).filter(Boolean);
  const identidade = partes.length ? partes.join("_") : "Empresa";
  const periodoTexto = ehMesCorridoInteiro(periodo.de, periodo.ate)
    ? periodo.de.slice(0, 7)
    : `${periodo.de}_a_${periodo.ate}`;

  return `LuckTank_${identidade}_${periodoTexto}.${extensao}`;
}
