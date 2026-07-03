import { describe, expect, it } from "vitest";
import { calcularResumoExport } from "./resumo";
import type { RegistroExport } from "./tipos";

function registro(parcial: Partial<RegistroExport>): RegistroExport {
  return {
    data: "2026-07-01",
    veiculoPlaca: "EXM1A23",
    motorista: "João da Silva",
    kmAtual: 1000,
    kmRodado: 100,
    litros: 20,
    valorPorLitro: 6,
    valorTotal: 120,
    consumoKml: 5,
    postoNome: "Posto Shell",
    postoCidade: "Campinas",
    numeroNota: "123",
    alertas: [],
    fotoUrl: null,
    ...parcial,
  };
}

describe("calcularResumoExport", () => {
  it("lista vazia: tudo zerado/nulo", () => {
    expect(calcularResumoExport([])).toEqual({
      totalLitros: 0,
      totalValor: 0,
      totalKmRodado: 0,
      precoMedioLitro: null,
      consumoMedioKml: null,
      quantidadeRegistros: 0,
    });
  });

  it("soma litros/valor e calcula preço médio por litro (soma/soma)", () => {
    const registros = [
      registro({ litros: 50, valorTotal: 300 }),
      registro({ litros: 50, valorTotal: 250 }),
    ];
    const resumo = calcularResumoExport(registros);
    expect(resumo.totalLitros).toBe(100);
    expect(resumo.totalValor).toBe(550);
    expect(resumo.precoMedioLitro).toBeCloseTo(5.5);
    expect(resumo.totalKmRodado).toBe(200); // 100 + 100 (default do helper `registro`)
  });

  it("consumo médio é soma dos km rodados / soma dos litros (não média das médias)", () => {
    // Duas viagens bem diferentes: 500km/50L (10km/L) e 50km/50L (1km/L) —
    // média das médias daria 5.5; soma/soma dá 550/100 = 5.5 também aqui por
    // coincidência, então uso valores que dão resultados DIFERENTES nos dois
    // métodos pra travar o comportamento certo.
    const registros = [
      registro({ kmRodado: 900, litros: 90 }), // 10 km/L
      registro({ kmRodado: 10, litros: 10 }), // 1 km/L
    ];
    const resumo = calcularResumoExport(registros);
    // média das médias = (10+1)/2 = 5.5 — NÃO deve ser esse o resultado.
    expect(resumo.consumoMedioKml).not.toBeCloseTo(5.5);
    // soma/soma = (900+10)/(90+10) = 9.1
    expect(resumo.consumoMedioKml).toBeCloseTo(9.1);
    expect(resumo.totalKmRodado).toBe(910);
  });

  it("registro sem km rodado válido entra no total de litros/valor, mas não no consumo médio", () => {
    const registros = [
      registro({ kmRodado: null, litros: 100, valorTotal: 600 }),
      registro({ kmRodado: 200, litros: 20, valorTotal: 120 }),
    ];
    const resumo = calcularResumoExport(registros);
    expect(resumo.totalLitros).toBe(120);
    expect(resumo.totalValor).toBe(720);
    expect(resumo.consumoMedioKml).toBeCloseTo(10); // só o segundo registro conta: 200/20
    expect(resumo.totalKmRodado).toBe(200); // idem — só o registro com km_rodado válido soma
  });

  it("kmRodado = 0 é tratado como inválido (mesma regra de estatisticas.ts)", () => {
    const registros = [registro({ kmRodado: 0, litros: 50, valorTotal: 300 })];
    const resumo = calcularResumoExport(registros);
    expect(resumo.consumoMedioKml).toBeNull();
    expect(resumo.totalLitros).toBe(50);
    expect(resumo.totalKmRodado).toBe(0);
  });
});
