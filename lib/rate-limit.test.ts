import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `redisConfigurado` e `emProducao` são calculados uma vez, no topo do
// módulo, a partir de process.env — por isso cada teste precisa resetar o
// módulo (vi.resetModules) e reimportar depois de ajustar o ambiente, em vez
// de só trocar process.env com o módulo já carregado.
describe("lib/rate-limit — comportamento sem Upstash configurado", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  function semUpstash() {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  it("em desenvolvimento, libera (fail-open) quando o Redis não está configurado", async () => {
    semUpstash();
    vi.stubEnv("NODE_ENV", "development");

    const { limitarLogin, limitarOcr, limitarPin, limitarAbastecimento, limitarRecuperacaoSenha } =
      await import("./rate-limit");

    await expect(limitarLogin("1.2.3.4", "a@b.com")).resolves.toEqual({ permitido: true });
    await expect(limitarOcr("1.2.3.4")).resolves.toEqual({ permitido: true });
    await expect(limitarPin("usuario-1")).resolves.toEqual({ permitido: true });
    await expect(limitarAbastecimento("1.2.3.4")).resolves.toEqual({ permitido: true });
    await expect(limitarRecuperacaoSenha("1.2.3.4", "a@b.com")).resolves.toEqual({
      permitido: true,
    });
  });

  it("em produção, falha fechado (lança) em vez de liberar quando o Redis não está configurado", async () => {
    semUpstash();
    vi.stubEnv("NODE_ENV", "production");

    const { limitarLogin, limitarOcr, limitarPin, limitarAbastecimento, limitarRecuperacaoSenha } =
      await import("./rate-limit");

    await expect(limitarLogin("1.2.3.4", "a@b.com")).rejects.toThrow(/produção/);
    await expect(limitarOcr("1.2.3.4")).rejects.toThrow(/produção/);
    await expect(limitarPin("usuario-1")).rejects.toThrow(/produção/);
    await expect(limitarAbastecimento("1.2.3.4")).rejects.toThrow(/produção/);
    await expect(limitarRecuperacaoSenha("1.2.3.4", "a@b.com")).rejects.toThrow(/produção/);
  });
});

// Incidente real (2026-09-21): o Upstash configurado em produção parou de
// resolver (DNS ENOTFOUND, banco provavelmente expirado/removido) e
// `.limit()` nunca tinha try/catch — login, OCR, PIN, abastecimento e
// recuperação de senha ficaram TODOS fora do ar (500), não só sem rate
// limit. Este bloco cobre o comportamento corrigido: uma falha em RUNTIME
// (Redis configurado, mas a chamada de rede falha) nunca pode derrubar a
// funcionalidade — diferente do caso "não configurado" acima, que continua
// fail-closed de propósito.
describe("lib/rate-limit — Upstash configurado mas inacessível em runtime", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    vi.doMock("@upstash/ratelimit", () => {
      class Ratelimit {
        static slidingWindow = vi.fn();
        limit = vi.fn().mockRejectedValue(new Error("fetch failed"));
      }
      return { Ratelimit };
    });
  });

  afterEach(() => {
    process.env = { ...envOriginal };
    vi.doUnmock("@upstash/ratelimit");
  });

  it("libera (fail-open) e não lança quando a chamada ao Upstash falha em runtime, mesmo em produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const {
      limitarLogin,
      limitarOcr,
      limitarPin,
      limitarMfa,
      limitarAbastecimento,
      limitarRecuperacaoSenha,
    } = await import("./rate-limit");

    await expect(limitarLogin("1.2.3.4", "a@b.com")).resolves.toEqual({ permitido: true });
    await expect(limitarOcr("1.2.3.4")).resolves.toEqual({ permitido: true });
    await expect(limitarPin("usuario-1")).resolves.toEqual({ permitido: true });
    await expect(limitarMfa("usuario-1")).resolves.toEqual({ permitido: true });
    await expect(limitarAbastecimento("1.2.3.4")).resolves.toEqual({ permitido: true });
    await expect(limitarRecuperacaoSenha("1.2.3.4", "a@b.com")).resolves.toEqual({
      permitido: true,
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
