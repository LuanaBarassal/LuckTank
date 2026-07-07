import { describe, expect, it } from "vitest";
import {
  limitesDoMes,
  mesAnterior,
  montarGradeMes,
  proximoMes,
  resolverMesReferencia,
  type AbastecimentoAgenda,
} from "./agenda";

const AGORA = new Date("2026-03-15T12:00:00.000Z");

function item(parcial: Partial<AbastecimentoAgenda> & { id: string; data_abastecimento: string }): AbastecimentoAgenda {
  return {
    hora: null,
    litros: 100,
    valor_total: 500,
    km_atual: 1000,
    km_rodado: null,
    consumo_kml: null,
    posto_nome: null,
    posto_cidade: null,
    posto_uf: null,
    forma_pagamento: null,
    numero_nota: null,
    bandeira_posto: null,
    veiculoNome: "1450",
    motoristaNome: "Marcos",
    ...parcial,
  };
}

describe("resolverMesReferencia", () => {
  it("usa o mês vindo da URL quando bem formado", () => {
    expect(resolverMesReferencia("2025-11", AGORA)).toBe("2025-11");
  });

  it("cai no mês atual quando ausente", () => {
    expect(resolverMesReferencia(null, AGORA)).toBe("2026-03");
  });

  it("cai no mês atual quando fora do formato (URL editada à mão)", () => {
    expect(resolverMesReferencia("mes-invalido", AGORA)).toBe("2026-03");
    expect(resolverMesReferencia("2026-13", AGORA)).toBe("2026-03"); // mês 13 não existe
  });
});

describe("limitesDoMes", () => {
  it("fevereiro bissexto tem 29 dias", () => {
    expect(limitesDoMes("2024-02")).toEqual({ de: "2024-02-01", ate: "2024-02-29" });
  });

  it("fevereiro não bissexto tem 28 dias", () => {
    expect(limitesDoMes("2026-02")).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
  });

  it("mês de 31 dias", () => {
    expect(limitesDoMes("2026-03")).toEqual({ de: "2026-03-01", ate: "2026-03-31" });
  });
});

describe("mesAnterior / proximoMes", () => {
  it("navega dentro do mesmo ano", () => {
    expect(mesAnterior("2026-03")).toBe("2026-02");
    expect(proximoMes("2026-03")).toBe("2026-04");
  });

  it("cruza virada de ano", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(proximoMes("2026-12")).toBe("2027-01");
  });
});

describe("montarGradeMes", () => {
  it("sempre devolve 42 dias (6 semanas)", () => {
    expect(montarGradeMes("2026-03", [])).toHaveLength(42);
  });

  it("marca dias fora do mês de referência", () => {
    // Março de 2026 começa numa domingo — não deveria sobrar dia de
    // fevereiro na primeira semana, mas sempre sobra dia de abril na última
    // (31 dias não enche as 6 semanas inteiras).
    const grade = montarGradeMes("2026-03", []);
    const doMes = grade.filter((d) => d.noMesReferencia);
    expect(doMes).toHaveLength(31);
    expect(doMes[0].data).toBe("2026-03-01");
    expect(doMes[30].data).toBe("2026-03-31");
  });

  it("agrupa itens no dia certo e ordena por hora", () => {
    const lista: AbastecimentoAgenda[] = [
      item({ id: "1", data_abastecimento: "2026-03-10", hora: "14:00" }),
      item({ id: "2", data_abastecimento: "2026-03-10", hora: "08:30" }),
      item({ id: "3", data_abastecimento: "2026-03-11", hora: "09:00" }),
    ];

    const grade = montarGradeMes("2026-03", lista);
    const dia10 = grade.find((d) => d.data === "2026-03-10")!;
    const dia11 = grade.find((d) => d.data === "2026-03-11")!;

    expect(dia10.itens.map((i) => i.id)).toEqual(["2", "1"]); // 08:30 antes de 14:00
    expect(dia11.itens.map((i) => i.id)).toEqual(["3"]);
  });

  it("dia sem abastecimento vem com lista vazia", () => {
    const grade = montarGradeMes("2026-03", []);
    const dia1 = grade.find((d) => d.data === "2026-03-01")!;
    expect(dia1.itens).toEqual([]);
  });
});
