// Estatísticas de consumo/custo por veículo — função pura (sem query aqui
// dentro), mesmo padrão de lib/validacao/regras.ts e
// lib/dashboard/agregacoes.ts: o Server Component busca o histórico bruto
// (todo ele, não só a página exibida na tabela) e chama isto pra calcular as
// médias.

export interface AbastecimentoParaEstatistica {
  data_abastecimento: string;
  km_rodado: number | null;
  litros: number;
  valor_total: number;
}

export interface EstatisticasVeiculo {
  totalAbastecimentos: number;
  // Quantos desses entraram no cálculo de km/L e R$/km — sempre <= total.
  abastecimentosComKmValido: number;
  // null quando não há nenhum registro com km_rodado válido ainda.
  consumoMedioKml: number | null;
  custoMedioPorKm: number | null;
  // null só quando não há abastecimento nenhum.
  gastoMedioPorAbastecimento: number | null;
  periodo: { inicio: string; fim: string } | null;
  // Totais pra linha de TOTAL da tabela (não médias) — litros/valor somam
  // TODOS os registros (mesma regra do gasto médio: sempre presentes,
  // sempre positivos); km rodado só soma os registros com km_rodado válido
  // (mesma regra crítica do consumo médio — registro sem km anterior pra
  // comparar não tem "km rodado" nenhum pra somar).
  totalLitros: number;
  totalValorGasto: number;
  totalKmRodado: number;
}

export function calcularEstatisticasVeiculo(
  lista: AbastecimentoParaEstatistica[]
): EstatisticasVeiculo {
  const totalAbastecimentos = lista.length;

  if (totalAbastecimentos === 0) {
    return {
      totalAbastecimentos: 0,
      abastecimentosComKmValido: 0,
      consumoMedioKml: null,
      custoMedioPorKm: null,
      gastoMedioPorAbastecimento: null,
      periodo: null,
      totalLitros: 0,
      totalValorGasto: 0,
      totalKmRodado: 0,
    };
  }

  const somaValorTotal = lista.reduce((soma, a) => soma + a.valor_total, 0);
  const somaLitrosTotal = lista.reduce((soma, a) => soma + a.litros, 0);
  const gastoMedioPorAbastecimento = somaValorTotal / totalAbastecimentos;

  const datas = lista.map((a) => a.data_abastecimento).sort();
  const periodo = { inicio: datas[0], fim: datas[datas.length - 1] };

  // Regra crítica: registro sem km_rodado válido (nulo ou zero — 1º
  // abastecimento do veículo, sem KM anterior pra comparar) entra no gasto
  // médio por abastecimento acima, mas NUNCA no consumo médio nem no custo
  // por km abaixo — misturar os dois distorceria as duas médias (dinheiro
  // gasto sem km rodado correspondente pra atribuir). `litros > 0` é
  // redundante com a validação do schema (sempre positivo), mas é barato
  // e deixa a função robusta mesmo se um dia entrar dado de outra origem.
  const validos = lista.filter((a) => a.km_rodado != null && a.km_rodado > 0 && a.litros > 0);
  const abastecimentosComKmValido = validos.length;

  if (abastecimentosComKmValido === 0) {
    return {
      totalAbastecimentos,
      abastecimentosComKmValido: 0,
      consumoMedioKml: null,
      custoMedioPorKm: null,
      gastoMedioPorAbastecimento,
      periodo,
      totalLitros: somaLitrosTotal,
      totalValorGasto: somaValorTotal,
      totalKmRodado: 0,
    };
  }

  const somaKmRodadoValidos = validos.reduce((soma, a) => soma + (a.km_rodado as number), 0);
  const somaLitrosValidos = validos.reduce((soma, a) => soma + a.litros, 0);
  const somaValorValidos = validos.reduce((soma, a) => soma + a.valor_total, 0);

  // Soma/soma (não média das médias individuais) — mais fiel quando os
  // abastecimentos têm tamanhos de "viagem" bem diferentes entre si.
  const consumoMedioKml = somaKmRodadoValidos / somaLitrosValidos;
  const custoMedioPorKm = somaValorValidos / somaKmRodadoValidos;

  return {
    totalAbastecimentos,
    abastecimentosComKmValido,
    consumoMedioKml,
    custoMedioPorKm,
    gastoMedioPorAbastecimento,
    periodo,
    totalLitros: somaLitrosTotal,
    totalValorGasto: somaValorTotal,
    totalKmRodado: somaKmRodadoValidos,
  };
}

// Comparativo consumo real x referência (manual/ficha técnica do modelo,
// cadastrada em veiculos.consumo_referencia_kml) — função pura separada de
// `calcularEstatisticasVeiculo` porque combina dois números de origens
// diferentes (média medida x valor cadastrado), não é mais uma agregação do
// histórico de abastecimentos por si só.
export type StatusComparativoConsumo =
  | "sem_referencia" // veículo ainda não tem consumo_referencia_kml cadastrado
  | "sem_dado_real" // tem referência, mas não há consumo médio real ainda no período
  | "pior_que_referencia" // consumo real pior que a referência além do limiar
  | "dentro_do_esperado"
  | "melhor_que_referencia"; // consumo real melhor que a referência além do limiar

export interface ComparativoConsumo {
  referenciaKml: number | null;
  realKml: number | null;
  // Negativo = consumo real PIOR que a referência (mais combustível por km).
  // Positivo = consumo real MELHOR que a referência. Null quando falta um dos dois lados.
  desvioPercentual: number | null;
  status: StatusComparativoConsumo;
}

// Limiar de desvio pra sair de "dentro do esperado" — ajustável, não vem de
// teste estatístico real, é um ponto de partida razoável (mesmo espírito de
// TOLERANCIA_DESVIO_CONSUMO em lib/validacao/regras.ts, mas são números
// independentes: aquele compara o veículo com o próprio histórico recente,
// este compara com um valor absoluto de fábrica).
export const LIMIAR_DESVIO_REFERENCIA_PERCENTUAL = 15;

export function compararConsumoComReferencia(
  consumoRealKml: number | null,
  consumoReferenciaKml: number | null
): ComparativoConsumo {
  if (consumoReferenciaKml == null || consumoReferenciaKml <= 0) {
    return { referenciaKml: consumoReferenciaKml, realKml: consumoRealKml, desvioPercentual: null, status: "sem_referencia" };
  }

  if (consumoRealKml == null) {
    return { referenciaKml: consumoReferenciaKml, realKml: null, desvioPercentual: null, status: "sem_dado_real" };
  }

  const desvioPercentual = ((consumoRealKml - consumoReferenciaKml) / consumoReferenciaKml) * 100;

  const status: StatusComparativoConsumo =
    desvioPercentual <= -LIMIAR_DESVIO_REFERENCIA_PERCENTUAL
      ? "pior_que_referencia"
      : desvioPercentual >= LIMIAR_DESVIO_REFERENCIA_PERCENTUAL
        ? "melhor_que_referencia"
        : "dentro_do_esperado";

  return {
    referenciaKml: consumoReferenciaKml,
    realKml: consumoRealKml,
    desvioPercentual: Number(desvioPercentual.toFixed(1)),
    status,
  };
}
