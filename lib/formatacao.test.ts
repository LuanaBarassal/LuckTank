import { describe, expect, it } from "vitest";
import { formatarVeiculo, formatarCnpj, formatarTelefone } from "./formatacao";

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

describe("formatarCnpj / formatarTelefone", () => {
  it("formata CNPJ gravado só com dígitos", () => {
    expect(formatarCnpj("18785716000107")).toBe("18.785.716/0001-07");
  });

  it("formata celular (11 dígitos) e fixo (10 dígitos)", () => {
    expect(formatarTelefone("13974064858")).toBe("(13) 97406-4858");
    expect(formatarTelefone("1332221111")).toBe("(13) 3222-1111");
  });

  it("devolve como veio se o tamanho não bater (nunca quebra a tela)", () => {
    expect(formatarCnpj("123")).toBe("123");
    expect(formatarTelefone("123")).toBe("123");
  });
});
