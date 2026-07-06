import { describe, expect, it } from "vitest";
import {
  calcularEstatisticasVeiculo,
  compararConsumoComReferencia,
  type AbastecimentoParaEstatistica,
} from "./estatisticas";

describe("calcularEstatisticasVeiculo", () => {
  it("retorna tudo nulo/zero quando não há abastecimento nenhum", () => {
    const stats = calcularEstatisticasVeiculo([]);
    expect(stats).toEqual({
      totalAbastecimentos: 0,
      abastecimentosComKmValido: 0,
      consumoMedioKml: null,
      custoMedioPorKm: null,
      gastoMedioPorAbastecimento: null,
      periodo: null,
      totalLitros: 0,
      totalValorGasto: 0,
      totalKmRodado: 0,
    });
  });

  it("calcula soma/soma (não média das médias) com registros de tamanhos diferentes", () => {
    // 500km/50L (10 km/L) e 100km/20L (5 km/L) — média das médias daria
    // 7.5 km/L; soma/soma dá (500+100)/(50+20) = 600/70 ≈ 8.57 km/L.
    const lista: AbastecimentoParaEstatistica[] = [
      { data_abastecimento: "2026-07-01", km_rodado: 500, litros: 50, valor_total: 300 },
      { data_abastecimento: "2026-07-02", km_rodado: 100, litros: 20, valor_total: 120 },
    ];
    const stats = calcularEstatisticasVeiculo(lista);
    expect(stats.totalAbastecimentos).toBe(2);
    expect(stats.abastecimentosComKmValido).toBe(2);
    expect(stats.consumoMedioKml).toBeCloseTo(600 / 70, 5);
    expect(stats.custoMedioPorKm).toBeCloseTo(420 / 600, 5);
    expect(stats.gastoMedioPorAbastecimento).toBeCloseTo(420 / 2, 5);
    expect(stats.periodo).toEqual({ inicio: "2026-07-01", fim: "2026-07-02" });
    expect(stats.totalLitros).toBe(70);
    expect(stats.totalValorGasto).toBe(420);
    expect(stats.totalKmRodado).toBe(600);
  });

  it("exclui registros sem km_rodado válido do consumo/custo por km, mas inclui no gasto médio", () => {
    const lista: AbastecimentoParaEstatistica[] = [
      // primeiro abastecimento do veículo — sem KM anterior, km_rodado null
      { data_abastecimento: "2026-07-01", km_rodado: null, litros: 60, valor_total: 400 },
      { data_abastecimento: "2026-07-02", km_rodado: 500, litros: 50, valor_total: 300 },
    ];
    const stats = calcularEstatisticasVeiculo(lista);
    expect(stats.totalAbastecimentos).toBe(2);
    expect(stats.abastecimentosComKmValido).toBe(1);
    // Só o segundo registro entra no consumo/custo por km:
    expect(stats.consumoMedioKml).toBeCloseTo(500 / 50, 5);
    expect(stats.custoMedioPorKm).toBeCloseTo(300 / 500, 5);
    // Os dois entram no gasto médio por abastecimento:
    expect(stats.gastoMedioPorAbastecimento).toBeCloseTo((400 + 300) / 2, 5);
    // Litros/valor somam os DOIS registros; km rodado só soma o válido —
    // é exatamente a mesma linha de TOTAL que aparece na tabela.
    expect(stats.totalLitros).toBe(110);
    expect(stats.totalValorGasto).toBe(700);
    expect(stats.totalKmRodado).toBe(500);
  });

  it("trata km_rodado igual a zero como inválido (não nulo, mas ainda assim excluído)", () => {
    const lista: AbastecimentoParaEstatistica[] = [
      { data_abastecimento: "2026-07-01", km_rodado: 0, litros: 40, valor_total: 250 },
    ];
    const stats = calcularEstatisticasVeiculo(lista);
    expect(stats.abastecimentosComKmValido).toBe(0);
    expect(stats.consumoMedioKml).toBeNull();
    expect(stats.custoMedioPorKm).toBeNull();
    expect(stats.gastoMedioPorAbastecimento).toBeCloseTo(250, 5);
    // km_rodado=0 não conta pro total de KM rodado (mesma regra de "inválido"),
    // mas litros/valor continuam contando normalmente.
    expect(stats.totalLitros).toBe(40);
    expect(stats.totalValorGasto).toBe(250);
    expect(stats.totalKmRodado).toBe(0);
  });

  it("consumo/custo por km ficam null quando NENHUM registro tem km_rodado válido", () => {
    const lista: AbastecimentoParaEstatistica[] = [
      { data_abastecimento: "2026-07-01", km_rodado: null, litros: 60, valor_total: 400 },
    ];
    const stats = calcularEstatisticasVeiculo(lista);
    expect(stats.totalAbastecimentos).toBe(1);
    expect(stats.abastecimentosComKmValido).toBe(0);
    expect(stats.consumoMedioKml).toBeNull();
    expect(stats.custoMedioPorKm).toBeNull();
    expect(stats.gastoMedioPorAbastecimento).toBeCloseTo(400, 5);
    expect(stats.periodo).toEqual({ inicio: "2026-07-01", fim: "2026-07-01" });
    expect(stats.totalLitros).toBe(60);
    expect(stats.totalValorGasto).toBe(400);
    expect(stats.totalKmRodado).toBe(0);
  });
});

describe("compararConsumoComReferencia", () => {
  it("status sem_referencia quando o veículo não tem consumo_referencia_kml cadastrado", () => {
    expect(compararConsumoComReferencia(7.5, null)).toEqual({
      referenciaKml: null,
      realKml: 7.5,
      desvioPercentual: null,
      status: "sem_referencia",
    });
  });

  it("status sem_dado_real quando há referência mas nenhum consumo médio real ainda", () => {
    expect(compararConsumoComReferencia(null, 8)).toEqual({
      referenciaKml: 8,
      realKml: null,
      desvioPercentual: null,
      status: "sem_dado_real",
    });
  });

  it("dentro_do_esperado quando o desvio é menor que o limiar (15%)", () => {
    // real 7.6 vs referência 8 → desvio de -5%, dentro da faixa
    const resultado = compararConsumoComReferencia(7.6, 8);
    expect(resultado.status).toBe("dentro_do_esperado");
    expect(resultado.desvioPercentual).toBeCloseTo(-5, 5);
  });

  it("pior_que_referencia quando o real consome mais que o limiar permite", () => {
    // real 6 vs referência 8 → desvio de -25%, pior que o limiar de -15%
    const resultado = compararConsumoComReferencia(6, 8);
    expect(resultado.status).toBe("pior_que_referencia");
    expect(resultado.desvioPercentual).toBeCloseTo(-25, 5);
  });

  it("melhor_que_referencia quando o real rende mais que o limiar", () => {
    // real 10 vs referência 8 → desvio de +25%
    const resultado = compararConsumoComReferencia(10, 8);
    expect(resultado.status).toBe("melhor_que_referencia");
    expect(resultado.desvioPercentual).toBeCloseTo(25, 5);
  });

  it("limiar exato (-15%) ainda conta como pior_que_referencia (limiar é <=, não <)", () => {
    // real 6.8 vs referência 8 → desvio exato de -15%
    const resultado = compararConsumoComReferencia(6.8, 8);
    expect(resultado.desvioPercentual).toBeCloseTo(-15, 5);
    expect(resultado.status).toBe("pior_que_referencia");
  });

  it("trata consumo_referencia_kml <= 0 como sem_referencia (dado cadastrado errado)", () => {
    expect(compararConsumoComReferencia(7, 0).status).toBe("sem_referencia");
  });
});
