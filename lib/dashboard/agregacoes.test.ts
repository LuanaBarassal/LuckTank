import { describe, expect, it } from "vitest";
import {
  agregarGastoPorDia,
  agregarPrecoMedioPorDia,
  agregarConsumoPorVeiculo,
  agregarConsumoPorMotorista,
  agregarPostosUtilizados,
  type AbastecimentoAgregavel,
} from "./agregacoes";

const dados: AbastecimentoAgregavel[] = [
  { data_abastecimento: "2026-07-01", litros: 100, valor_total: 500, consumo_kml: 5, veiculo_id: "v1", motorista_id: "m1", motorista_nome_livre: null, posto_nome: "Posto A" },
  { data_abastecimento: "2026-07-01", litros: 50, valor_total: 300, consumo_kml: 6, veiculo_id: "v2", motorista_id: null, motorista_nome_livre: "João", posto_nome: "Posto A" },
  { data_abastecimento: "2026-07-02", litros: 80, valor_total: 480, consumo_kml: 7, veiculo_id: "v1", motorista_id: "m1", motorista_nome_livre: null, posto_nome: "Posto B" },
];

describe("agregarGastoPorDia", () => {
  it("soma o valor_total por dia, ordenado", () => {
    const resultado = agregarGastoPorDia(dados);
    expect(resultado).toEqual([
      { data: "01/07", valor: 800 },
      { data: "02/07", valor: 480 },
    ]);
  });
});

describe("agregarPrecoMedioPorDia", () => {
  it("calcula valor total / litros totais do dia", () => {
    const resultado = agregarPrecoMedioPorDia(dados);
    expect(resultado.find((d) => d.data === "01/07")?.precoMedio).toBeCloseTo(800 / 150, 2);
  });

  it("não divide por zero quando não há litros", () => {
    const resultado = agregarPrecoMedioPorDia([]);
    expect(resultado).toEqual([]);
  });
});

describe("agregarConsumoPorVeiculo", () => {
  it("faz a média de consumo_kml por veículo, ignorando null", () => {
    const comConsumoNulo: AbastecimentoAgregavel[] = [
      ...dados,
      { data_abastecimento: "2026-07-03", litros: 10, valor_total: 60, consumo_kml: null, veiculo_id: "v1", motorista_id: "m1", motorista_nome_livre: null, posto_nome: null },
    ];
    const resultado = agregarConsumoPorVeiculo(comConsumoNulo, new Map([["v1", "AAA1111"], ["v2", "BBB2222"]]));
    expect(resultado.find((v) => v.nome === "AAA1111")?.consumoMedio).toBe(6);
    expect(resultado.find((v) => v.nome === "BBB2222")?.consumoMedio).toBe(6);
  });

  it("usa 'Desconhecido' quando o veículo não está no mapa de placas", () => {
    const resultado = agregarConsumoPorVeiculo(dados, new Map());
    expect(resultado.every((v) => v.nome === "Desconhecido")).toBe(true);
  });
});

describe("agregarConsumoPorMotorista", () => {
  it("agrupa por motorista_id quando presente, e por nome livre quando não", () => {
    const resultado = agregarConsumoPorMotorista(dados, new Map([["m1", "Marcos"]]));
    expect(resultado.find((m) => m.nome === "Marcos")?.consumoMedio).toBe(6);
    expect(resultado.find((m) => m.nome === "João")?.consumoMedio).toBe(6);
  });

  it("usa 'Não informado' quando não há motorista_id nem nome livre", () => {
    const semMotorista: AbastecimentoAgregavel[] = [
      { data_abastecimento: "2026-07-01", litros: 10, valor_total: 60, consumo_kml: 4, veiculo_id: "v1", motorista_id: null, motorista_nome_livre: null, posto_nome: null },
    ];
    const resultado = agregarConsumoPorMotorista(semMotorista, new Map());
    expect(resultado[0].nome).toBe("Não informado");
  });
});

describe("agregarPostosUtilizados", () => {
  it("conta ocorrências por posto e ordena do mais usado pro menos usado", () => {
    const resultado = agregarPostosUtilizados(dados);
    expect(resultado[0]).toEqual({ posto: "Posto A", quantidade: 2 });
    expect(resultado[1]).toEqual({ posto: "Posto B", quantidade: 1 });
  });

  it("usa 'Não informado' quando posto_nome é nulo/vazio", () => {
    const semPosto: AbastecimentoAgregavel[] = [
      { data_abastecimento: "2026-07-01", litros: 10, valor_total: 60, consumo_kml: 4, veiculo_id: "v1", motorista_id: null, motorista_nome_livre: null, posto_nome: "  " },
    ];
    const resultado = agregarPostosUtilizados(semPosto);
    expect(resultado[0].posto).toBe("Não informado");
  });

  it("limita a 10 postos mais usados", () => {
    const muitosPostos: AbastecimentoAgregavel[] = Array.from({ length: 15 }, (_, i) => ({
      data_abastecimento: "2026-07-01",
      litros: 10,
      valor_total: 60,
      consumo_kml: 4,
      veiculo_id: "v1",
      motorista_id: null,
      motorista_nome_livre: null,
      posto_nome: `Posto ${i}`,
    }));
    expect(agregarPostosUtilizados(muitosPostos)).toHaveLength(10);
  });
});
