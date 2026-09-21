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
