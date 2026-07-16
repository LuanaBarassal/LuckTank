import { describe, expect, it } from "vitest";
import { validarSenha, TAMANHO_MINIMO_SENHA } from "./senha";

describe("validarSenha", () => {
  it("rejeita senha menor que o mínimo", () => {
    const resultado = validarSenha("x".repeat(TAMANHO_MINIMO_SENHA - 1));
    expect(resultado.valida).toBe(false);
    expect(resultado.erro).toContain("8 caracteres");
  });

  it("aceita senha exatamente no tamanho mínimo (limite exato)", () => {
    const resultado = validarSenha("Xk8!brzq");
    expect(resultado.valida).toBe(true);
  });

  it("rejeita senha trivial conhecida (case-insensitive)", () => {
    expect(validarSenha("12345678").valida).toBe(false);
    expect(validarSenha("SENHA123").valida).toBe(false);
  });

  it("rejeita caractere único repetido, mesmo passando do tamanho mínimo", () => {
    const resultado = validarSenha("aaaaaaaaaaaa");
    expect(resultado.valida).toBe(false);
    expect(resultado.erro).toContain("repetido");
  });

  it("aceita senha razoável qualquer, sem exigir símbolo/maiúscula obrigatórios", () => {
    expect(validarSenha("cavalobranco").valida).toBe(true);
    expect(validarSenha("MinhaSenhaForte2026").valida).toBe(true);
  });
});
