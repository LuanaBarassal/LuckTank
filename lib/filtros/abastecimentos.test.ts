import { describe, expect, it } from "vitest";
import { parseFiltrosAbastecimento, resolverPeriodo, aplicarFiltrosQuery } from "./abastecimentos";

describe("parseFiltrosAbastecimento", () => {
  it("lê data/veículo/motorista válidos da URL", () => {
    const filtros = parseFiltrosAbastecimento({
      de: "2026-06-01",
      ate: "2026-06-30",
      veiculo_id: "a1b2c3d4-0000-4000-8000-000000000000",
      motorista_id: "b1b2c3d4-0000-4000-8000-000000000000",
    });
    expect(filtros).toEqual({
      de: "2026-06-01",
      ate: "2026-06-30",
      veiculoId: "a1b2c3d4-0000-4000-8000-000000000000",
      motoristaId: "b1b2c3d4-0000-4000-8000-000000000000",
      motoristaNomeLivre: null,
    });
  });

  it("ignora valores fora do formato em vez de lançar erro (URL é editável à mão)", () => {
    const filtros = parseFiltrosAbastecimento({
      de: "não é uma data",
      veiculo_id: "não é um uuid",
    });
    expect(filtros.de).toBeNull();
    expect(filtros.veiculoId).toBeNull();
  });

  it("aceita motorista_nome livre sem validação de formato (é texto livre)", () => {
    const filtros = parseFiltrosAbastecimento({ motorista_nome: "João da Silva" });
    expect(filtros.motoristaNomeLivre).toBe("João da Silva");
    expect(filtros.motoristaId).toBeNull();
  });

  it("lida com searchParams vazio", () => {
    const filtros = parseFiltrosAbastecimento({});
    expect(filtros).toEqual({
      de: null,
      ate: null,
      veiculoId: null,
      motoristaId: null,
      motoristaNomeLivre: null,
    });
  });
});

describe("resolverPeriodo", () => {
  const AGORA = new Date("2026-03-15T12:00:00.000Z");

  it("sem de/ate na URL, usa o padrão 'este mês'", () => {
    expect(resolverPeriodo({ de: null, ate: null }, AGORA)).toEqual({
      de: "2026-03-01",
      ate: "2026-03-15",
    });
  });

  it("com de/ate explícitos, usa exatamente o que veio da URL", () => {
    expect(resolverPeriodo({ de: "2026-01-01", ate: "2026-01-31" }, AGORA)).toEqual({
      de: "2026-01-01",
      ate: "2026-01-31",
    });
  });

  it("só com 'de', deixa o fim em aberto (até hoje)", () => {
    expect(resolverPeriodo({ de: "2026-01-01", ate: null }, AGORA)).toEqual({
      de: "2026-01-01",
      ate: "2026-03-15",
    });
  });

  it("só com 'ate', deixa o início bem no passado", () => {
    expect(resolverPeriodo({ de: null, ate: "2026-01-31" }, AGORA)).toEqual({
      de: "1970-01-01",
      ate: "2026-01-31",
    });
  });
});

// Fake mínimo de um query builder encadeável (mesmo formato do
// supabase-js: cada filtro devolve o próprio builder) — só pra confirmar que
// aplicarFiltrosQuery monta a cadeia certa sem precisar de um banco real.
function criarQueryFalsa() {
  const chamadas: [string, string, string][] = [];
  const builder = {
    gte(coluna: string, valor: string) {
      chamadas.push(["gte", coluna, valor]);
      return builder;
    },
    lte(coluna: string, valor: string) {
      chamadas.push(["lte", coluna, valor]);
      return builder;
    },
    eq(coluna: string, valor: string) {
      chamadas.push(["eq", coluna, valor]);
      return builder;
    },
    chamadas,
  };
  return builder;
}

describe("aplicarFiltrosQuery", () => {
  it("sempre aplica o período (gte + lte)", () => {
    const query = criarQueryFalsa();
    aplicarFiltrosQuery(
      query,
      { de: null, ate: null, veiculoId: null, motoristaId: null, motoristaNomeLivre: null },
      { de: "2026-03-01", ate: "2026-03-15" }
    );
    expect(query.chamadas).toEqual([
      ["gte", "data_abastecimento", "2026-03-01"],
      ["lte", "data_abastecimento", "2026-03-15"],
    ]);
  });

  it("combina data + veículo + motorista quando todos presentes", () => {
    const query = criarQueryFalsa();
    aplicarFiltrosQuery(
      query,
      {
        de: "2026-03-01",
        ate: "2026-03-15",
        veiculoId: "veiculo-1",
        motoristaId: "motorista-1",
        motoristaNomeLivre: null,
      },
      { de: "2026-03-01", ate: "2026-03-15" }
    );
    expect(query.chamadas).toEqual([
      ["gte", "data_abastecimento", "2026-03-01"],
      ["lte", "data_abastecimento", "2026-03-15"],
      ["eq", "veiculo_id", "veiculo-1"],
      ["eq", "motorista_id", "motorista-1"],
    ]);
  });

  it("usa motorista_nome_livre quando não há motorista_id (mutuamente exclusivos na UI)", () => {
    const query = criarQueryFalsa();
    aplicarFiltrosQuery(
      query,
      {
        de: null,
        ate: null,
        veiculoId: null,
        motoristaId: null,
        motoristaNomeLivre: "João da Silva",
      },
      { de: "2026-03-01", ate: "2026-03-15" }
    );
    expect(query.chamadas).toContainEqual(["eq", "motorista_nome_livre", "João da Silva"]);
  });
});
