import { describe, expect, it, vi, beforeEach } from "vitest";
import { gerarHashPin, REGEX_PIN } from "./pin";

describe("REGEX_PIN", () => {
  it("aceita só 6 dígitos exatos", () => {
    expect(REGEX_PIN.test("123456")).toBe(true);
    expect(REGEX_PIN.test("12345")).toBe(false);
    expect(REGEX_PIN.test("1234567")).toBe(false);
    expect(REGEX_PIN.test("12345a")).toBe(false);
    expect(REGEX_PIN.test("")).toBe(false);
  });
});

describe("gerarHashPin", () => {
  it("gera formato 'salt:hash' em hex, com salt diferente a cada chamada", () => {
    const hash1 = gerarHashPin("123456");
    const hash2 = gerarHashPin("123456");

    expect(hash1).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(hash2).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    // Mesmo PIN, hashes diferentes — o salt aleatório garante isso.
    expect(hash1).not.toBe(hash2);
  });
});

// `compararHashPin` não é exportado (só usado internamente por
// verificarPinDoUsuario) — testado indiretamente através dele, mockando
// admin client e rate limit, mesmo padrão dos outros testes de Server
// Action/módulo server-only deste projeto.
const limitarPinMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  limitarPin: (...args: unknown[]) => limitarPinMock(...args),
}));

const singleMock = vi.fn();
const adminMock = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ single: singleMock })),
    })),
  })),
};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminMock,
}));

describe("verificarPinDoUsuario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitarPinMock.mockResolvedValue({ permitido: true });
  });

  it("recusa formato inválido sem consultar rate limit nem banco", async () => {
    const { verificarPinDoUsuario } = await import("./pin");
    const ok = await verificarPinDoUsuario("u1", "abc");

    expect(ok).toBe(false);
    expect(limitarPinMock).not.toHaveBeenCalled();
    expect(adminMock.from).not.toHaveBeenCalled();
  });

  it("recusa quando o rate limit estourou, sem consultar o banco", async () => {
    limitarPinMock.mockResolvedValue({ permitido: false });

    const { verificarPinDoUsuario } = await import("./pin");
    const ok = await verificarPinDoUsuario("u1", "123456");

    expect(ok).toBe(false);
    expect(adminMock.from).not.toHaveBeenCalled();
  });

  it("recusa quando o usuário não tem PIN configurado", async () => {
    singleMock.mockResolvedValue({ data: { pin_hash: null } });

    const { verificarPinDoUsuario } = await import("./pin");
    const ok = await verificarPinDoUsuario("u1", "123456");

    expect(ok).toBe(false);
  });

  it("aceita o PIN correto contra o hash salvo", async () => {
    const { gerarHashPin, verificarPinDoUsuario } = await import("./pin");
    singleMock.mockResolvedValue({ data: { pin_hash: gerarHashPin("482913") } });

    await expect(verificarPinDoUsuario("u1", "482913")).resolves.toBe(true);
  });

  it("recusa PIN errado contra o hash salvo", async () => {
    const { gerarHashPin, verificarPinDoUsuario } = await import("./pin");
    singleMock.mockResolvedValue({ data: { pin_hash: gerarHashPin("482913") } });

    await expect(verificarPinDoUsuario("u1", "111111")).resolves.toBe(false);
  });

  it("recusa hash malformado (sem salt) em vez de lançar", async () => {
    singleMock.mockResolvedValue({ data: { pin_hash: "hash-sem-formato-esperado" } });

    const { verificarPinDoUsuario } = await import("./pin");
    await expect(verificarPinDoUsuario("u1", "123456")).resolves.toBe(false);
  });
});
