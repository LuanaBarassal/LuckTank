import { describe, expect, it } from "vitest";
import { formatarVeiculo } from "./formatacao";

describe("formatarVeiculo", () => {
  it("combina prefixo e placa quando o prefixo existe", () => {
    expect(formatarVeiculo("1450", "EXM1A23")).toBe("1450 · EXM1A23");
  });

  it("mostra só a placa quando não há prefixo (null)", () => {
    expect(formatarVeiculo(null, "EXM1A23")).toBe("EXM1A23");
  });

  it("mostra só a placa quando não há prefixo (undefined)", () => {
    expect(formatarVeiculo(undefined, "EXM1A23")).toBe("EXM1A23");
  });

  it("mostra só a placa quando o prefixo é string vazia", () => {
    expect(formatarVeiculo("", "EXM1A23")).toBe("EXM1A23");
  });
});
