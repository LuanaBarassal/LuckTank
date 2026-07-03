// Médias do período pro export — mesma regra de "soma/soma" (não média das
// médias) já usada em lib/onibus/estatisticas.ts, pelo mesmo motivo: mais
// fiel quando os registros têm tamanhos de "abastecimento" bem diferentes
// entre si. Só entram no consumo médio os registros com km_rodado válido
// (mesma regra crítica de estatisticas.ts) — os outros ainda contam pro
// total de litros/valor.

import type { RegistroExport, ResumoExport } from "./tipos";

export function calcularResumoExport(registros: RegistroExport[]): ResumoExport {
  const totalLitros = registros.reduce((soma, r) => soma + r.litros, 0);
  const totalValor = registros.reduce((soma, r) => soma + r.valorTotal, 0);
  const precoMedioLitro = totalLitros > 0 ? totalValor / totalLitros : null;

  const validos = registros.filter((r) => r.kmRodado != null && r.kmRodado > 0 && r.litros > 0);
  const somaKmValidos = validos.reduce((soma, r) => soma + (r.kmRodado as number), 0);
  const somaLitrosValidos = validos.reduce((soma, r) => soma + r.litros, 0);
  const consumoMedioKml = somaLitrosValidos > 0 ? somaKmValidos / somaLitrosValidos : null;

  return {
    totalLitros,
    totalValor,
    totalKmRodado: somaKmValidos,
    precoMedioLitro,
    consumoMedioKml,
    quantidadeRegistros: registros.length,
  };
}
