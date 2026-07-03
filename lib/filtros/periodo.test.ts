import { describe, expect, it } from "vitest";
import { calcularPeriodo } from "./periodo";

// Data de referência fixa em todos os testes — nunca `new Date()` sem
// argumento, senão o teste vira não-determinístico.
const AGORA = new Date("2026-03-15T12:00:00.000Z");

describe("calcularPeriodo", () => {
  it("hoje: de e ate são o mesmo dia", () => {
    expect(calcularPeriodo("hoje", AGORA)).toEqual({ de: "2026-03-15", ate: "2026-03-15" });
  });

  it("7dias: inclui hoje, 7 dias no total", () => {
    expect(calcularPeriodo("7dias", AGORA)).toEqual({ de: "2026-03-09", ate: "2026-03-15" });
  });

  it("esteMes: do dia 1 do mês corrente até hoje", () => {
    expect(calcularPeriodo("esteMes", AGORA)).toEqual({ de: "2026-03-01", ate: "2026-03-15" });
  });

  it("mesPassado: mês anterior inteiro", () => {
    expect(calcularPeriodo("mesPassado", AGORA)).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
  });

  it("mesPassado: cruza virada de ano corretamente", () => {
    const emJaneiro = new Date("2026-01-10T12:00:00.000Z");
    expect(calcularPeriodo("mesPassado", emJaneiro)).toEqual({ de: "2025-12-01", ate: "2025-12-31" });
  });

  it("mesPassado: respeita ano bissexto (fevereiro com 29 dias)", () => {
    const emMarcoBissexto = new Date("2024-03-05T12:00:00.000Z");
    expect(calcularPeriodo("mesPassado", emMarcoBissexto)).toEqual({ de: "2024-02-01", ate: "2024-02-29" });
  });

  it("7dias: cruza virada de mês corretamente", () => {
    const inicioDeMes = new Date("2026-04-03T12:00:00.000Z");
    expect(calcularPeriodo("7dias", inicioDeMes)).toEqual({ de: "2026-03-28", ate: "2026-04-03" });
  });
});
