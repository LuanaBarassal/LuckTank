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
    };
  }

  const somaValorTotal = lista.reduce((soma, a) => soma + a.valor_total, 0);
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
  };
}
