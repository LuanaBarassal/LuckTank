import { describe, expect, it, vi, beforeEach } from "vitest";

const limitarLoginMock = vi.fn();
const limitarMfaMock = vi.fn();
const limitarRecuperacaoSenhaMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  limitarLogin: (...args: unknown[]) => limitarLoginMock(...args),
  limitarMfa: (...args: unknown[]) => limitarMfaMock(...args),
  limitarRecuperacaoSenha: (...args: unknown[]) => limitarRecuperacaoSenhaMock(...args),
  obterIp: () => "127.0.0.1",
}));

vi.mock("next/headers", () => ({
  headers: async () => new Map(),
}));

vi.mock("@/lib/url-atual", () => ({
  urlBaseAtual: async () => "https://lucktank.exemplo",
}));

const signInWithPasswordMock = vi.fn();
const getUserMock = vi.fn();
const mfaGetAALMock = vi.fn();
const mfaListFactorsMock = vi.fn();
const mfaChallengeAndVerifyMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      getUser: getUserMock,
      mfa: {
        getAuthenticatorAssuranceLevel: mfaGetAALMock,
        listFactors: mfaListFactorsMock,
        challengeAndVerify: mfaChallengeAndVerifyMock,
      },
    },
  }),
}));

// Achado de auditoria (MFA): login() com senha correta não pode devolver
// sucesso pleno quando a conta tem um fator matriculado — precisa sinalizar
// `mfaRequerido` pro client pedir o código, em vez de deixar a sessão AAL1
// passar como se fosse suficiente (é o middleware, testado à parte, que
// efetivamente barra o acesso; aqui testamos o sinal que alimenta a UI).
describe("login — integração com MFA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitarLoginMock.mockResolvedValue({ permitido: true });
    signInWithPasswordMock.mockResolvedValue({ error: null });
  });

  it("devolve sucesso pleno quando a conta não tem MFA (nextLevel aal1)", async () => {
    mfaGetAALMock.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });

    const { login } = await import("./sessao-actions");
    const resultado = await login("a@b.com", "senhaboa123");

    expect(resultado).toEqual({});
  });

  it("sinaliza mfaRequerido quando a conta tem fator mas a sessão ainda é aal1", async () => {
    mfaGetAALMock.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });

    const { login } = await import("./sessao-actions");
    const resultado = await login("a@b.com", "senhaboa123");

    expect(resultado).toEqual({ mfaRequerido: true });
  });

  it("não sinaliza mfaRequerido quando a sessão já está em aal2", async () => {
    mfaGetAALMock.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });

    const { login } = await import("./sessao-actions");
    const resultado = await login("a@b.com", "senhaboa123");

    expect(resultado).toEqual({});
  });

  it("nunca chega a checar MFA se a senha já estava errada", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: new Error("invalid credentials") });

    const { login } = await import("./sessao-actions");
    const resultado = await login("a@b.com", "senhaerrada");

    expect(resultado.error).toBeTruthy();
    expect(mfaGetAALMock).not.toHaveBeenCalled();
  });
});

describe("confirmarDesafioMfaLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitarMfaMock.mockResolvedValue({ permitido: true });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("recusa sem sessão ativa", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { confirmarDesafioMfaLogin } = await import("./sessao-actions");
    const resultado = await confirmarDesafioMfaLogin("123456");

    expect(resultado.error).toMatch(/Sessão expirada/);
  });

  it("respeita rate limit por usuário", async () => {
    limitarMfaMock.mockResolvedValue({ permitido: false });

    const { confirmarDesafioMfaLogin } = await import("./sessao-actions");
    const resultado = await confirmarDesafioMfaLogin("123456");

    expect(resultado.error).toMatch(/Muitas tentativas/);
    expect(mfaListFactorsMock).not.toHaveBeenCalled();
  });

  it("recusa formato de código inválido sem consultar fatores", async () => {
    const { confirmarDesafioMfaLogin } = await import("./sessao-actions");
    const resultado = await confirmarDesafioMfaLogin("abc");

    expect(resultado.error).toBeTruthy();
    expect(mfaListFactorsMock).not.toHaveBeenCalled();
  });

  it("usa o fator TOTP verificado e chama challengeAndVerify", async () => {
    mfaListFactorsMock.mockResolvedValue({
      data: { totp: [{ id: "fator-1", status: "verified" }] },
      error: null,
    });
    mfaChallengeAndVerifyMock.mockResolvedValue({ data: {}, error: null });

    const { confirmarDesafioMfaLogin } = await import("./sessao-actions");
    const resultado = await confirmarDesafioMfaLogin("123456");

    expect(mfaChallengeAndVerifyMock).toHaveBeenCalledWith({
      factorId: "fator-1",
      code: "123456",
    });
    expect(resultado).toEqual({});
  });

  it("devolve erro genérico em código errado (nunca revela o motivo específico)", async () => {
    mfaListFactorsMock.mockResolvedValue({
      data: { totp: [{ id: "fator-1", status: "verified" }] },
      error: null,
    });
    mfaChallengeAndVerifyMock.mockResolvedValue({ data: null, error: new Error("invalid code") });

    const { confirmarDesafioMfaLogin } = await import("./sessao-actions");
    const resultado = await confirmarDesafioMfaLogin("000000");

    expect(resultado.error).toBe("Código inválido ou expirado.");
  });
});
