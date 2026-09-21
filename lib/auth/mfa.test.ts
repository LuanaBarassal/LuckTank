import { describe, expect, it, vi, beforeEach } from "vitest";

const limitarMfaMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  limitarMfa: (...args: unknown[]) => limitarMfaMock(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mfaMock = {
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
};
const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
      mfa: mfaMock,
    },
  }),
}));

describe("lib/auth/mfa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitarMfaMock.mockResolvedValue({ permitido: true });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  describe("listarFatoresMfa", () => {
    it("mapeia só os fatores TOTP verificados devolvidos pela API", async () => {
      mfaMock.listFactors.mockResolvedValue({
        data: {
          all: [],
          totp: [{ id: "f1", status: "verified", created_at: "2026-01-01" }],
        },
        error: null,
      });

      const { listarFatoresMfa } = await import("./mfa");
      const fatores = await listarFatoresMfa();

      expect(fatores).toEqual([{ id: "f1", status: "verified", criadoEm: "2026-01-01" }]);
    });

    it("devolve lista vazia em erro, sem lançar", async () => {
      mfaMock.listFactors.mockResolvedValue({ data: null, error: new Error("falhou") });

      const { listarFatoresMfa } = await import("./mfa");
      await expect(listarFatoresMfa()).resolves.toEqual([]);
    });
  });

  describe("iniciarMatriculaMfa", () => {
    it("remove fatores TOTP unverified órfãos antes de matricular um novo", async () => {
      mfaMock.listFactors.mockResolvedValue({
        data: {
          all: [
            { id: "orfao-1", factor_type: "totp", status: "unverified" },
            { id: "verificado-1", factor_type: "totp", status: "verified" },
            { id: "phone-1", factor_type: "phone", status: "unverified" },
          ],
          totp: [],
        },
        error: null,
      });
      mfaMock.enroll.mockResolvedValue({
        data: { id: "novo-fator", type: "totp", totp: { qr_code: "<svg/>", secret: "SEGREDO", uri: "otpauth://" } },
        error: null,
      });

      const { iniciarMatriculaMfa } = await import("./mfa");
      const resultado = await iniciarMatriculaMfa();

      expect(mfaMock.unenroll).toHaveBeenCalledTimes(1);
      expect(mfaMock.unenroll).toHaveBeenCalledWith({ factorId: "orfao-1" });
      expect(resultado.data).toEqual({
        factorId: "novo-fator",
        qrCodeSvg: "<svg/>",
        segredo: "SEGREDO",
      });
    });

    it("devolve erro quando o enroll falha", async () => {
      mfaMock.listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
      mfaMock.enroll.mockResolvedValue({ data: null, error: new Error("falhou") });

      const { iniciarMatriculaMfa } = await import("./mfa");
      const resultado = await iniciarMatriculaMfa();

      expect(resultado.error).toBeTruthy();
      expect(resultado.data).toBeUndefined();
    });
  });

  describe("confirmarMatriculaMfa", () => {
    it("recusa código com formato inválido sem chamar a API", async () => {
      const { confirmarMatriculaMfa } = await import("./mfa");
      const resultado = await confirmarMatriculaMfa("fator-1", "12ab");

      expect(resultado.error).toMatch(/6 dígitos/);
      expect(mfaMock.challenge).not.toHaveBeenCalled();
    });

    it("respeita o rate limit por usuário", async () => {
      limitarMfaMock.mockResolvedValue({ permitido: false });

      const { confirmarMatriculaMfa } = await import("./mfa");
      const resultado = await confirmarMatriculaMfa("fator-1", "123456");

      expect(resultado.error).toMatch(/Muitas tentativas/);
      expect(mfaMock.challenge).not.toHaveBeenCalled();
    });

    it("confirma com challenge + verify quando o código é válido", async () => {
      mfaMock.challenge.mockResolvedValue({ data: { id: "desafio-1" }, error: null });
      mfaMock.verify.mockResolvedValue({ data: {}, error: null });

      const { confirmarMatriculaMfa } = await import("./mfa");
      const resultado = await confirmarMatriculaMfa("fator-1", "123456");

      expect(mfaMock.verify).toHaveBeenCalledWith({
        factorId: "fator-1",
        challengeId: "desafio-1",
        code: "123456",
      });
      expect(resultado.data).toBe(true);
    });
  });

  describe("desmatricularMfa", () => {
    it("propaga erro do Supabase (ex.: exige AAL2) como mensagem amigável", async () => {
      mfaMock.unenroll.mockResolvedValue({ data: null, error: new Error("AAL2 required") });

      const { desmatricularMfa } = await import("./mfa");
      const resultado = await desmatricularMfa("fator-1");

      expect(resultado.error).toBeTruthy();
    });

    it("remove com sucesso", async () => {
      mfaMock.unenroll.mockResolvedValue({ data: { id: "fator-1" }, error: null });

      const { desmatricularMfa } = await import("./mfa");
      const resultado = await desmatricularMfa("fator-1");

      expect(resultado.data).toBe(true);
    });
  });
});
