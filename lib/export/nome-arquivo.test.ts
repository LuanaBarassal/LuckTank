import { describe, expect, it } from "vitest";
import { gerarNomeArquivoExport } from "./nome-arquivo";

describe("gerarNomeArquivoExport", () => {
  it("usa 'YYYY-MM' quando o período cobre um mês corrido inteiro", () => {
    expect(
      gerarNomeArquivoExport(["Expresso Mundial"], { de: "2026-06-01", ate: "2026-06-30" }, "xlsx")
    ).toBe("LuckTank_ExpressoMundial_2026-06.xlsx");
  });

  it("respeita meses de 28/29/31 dias ao checar 'mês corrido inteiro'", () => {
    expect(
      gerarNomeArquivoExport(["Expresso Mundial"], { de: "2026-02-01", ate: "2026-02-28" }, "xlsx")
    ).toBe("LuckTank_ExpressoMundial_2026-02.xlsx");
    // 2024 é bissexto — fevereiro tem 29 dias.
    expect(
      gerarNomeArquivoExport(["Expresso Mundial"], { de: "2024-02-01", ate: "2024-02-28" }, "xlsx")
    ).toBe("LuckTank_ExpressoMundial_2024-02-01_a_2024-02-28.xlsx");
  });

  it("usa o intervalo explícito quando o período não é um mês corrido inteiro", () => {
    expect(
      gerarNomeArquivoExport(["Expresso Mundial"], { de: "2026-06-05", ate: "2026-06-20" }, "pdf")
    ).toBe("LuckTank_ExpressoMundial_2026-06-05_a_2026-06-20.pdf");
  });

  it("remove acentos e espaços do nome da empresa", () => {
    expect(
      gerarNomeArquivoExport(["Transportes São João Ltda"], { de: "2026-06-01", ate: "2026-06-30" }, "xlsx")
    ).toBe("LuckTank_TransportesSaoJoaoLtda_2026-06.xlsx");
  });

  it("junta múltiplos segmentos com '_', separados (prefixo + placa do veículo)", () => {
    expect(
      gerarNomeArquivoExport(["1450", "EXM1A23"], { de: "2026-06-01", ate: "2026-06-30" }, "xlsx")
    ).toBe("LuckTank_1450_EXM1A23_2026-06.xlsx");
  });

  it("ignora segmento vazio/nulo (veículo sem prefixo — só a placa entra)", () => {
    expect(
      gerarNomeArquivoExport(["", "EXM1A23"], { de: "2026-06-01", ate: "2026-06-30" }, "xlsx")
    ).toBe("LuckTank_EXM1A23_2026-06.xlsx");
  });
});
