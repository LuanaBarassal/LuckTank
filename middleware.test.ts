import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
const mfaGetAALMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: getUserMock,
      mfa: { getAuthenticatorAssuranceLevel: mfaGetAALMock },
    },
  }),
}));

function request(pathname: string) {
  return new NextRequest(new URL(pathname, "https://lucktank.exemplo"));
}

// Achado de auditoria (MFA): o middleware é a peça que de fato bloqueia
// acesso às rotas protegidas quando a conta tem MFA matriculado mas a
// sessão ainda não passou pelo desafio (AAL1, com nextLevel=aal2) — os
// testes de lib/auth/sessao-actions.test.ts cobrem só o SINAL que alimenta
// a UI de login, não a barreira em si.
describe("middleware — barreira de MFA/sessão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("redireciona pro login quando não há sessão nenhuma", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { middleware } = await import("./middleware");
    const resposta = await middleware(request("/dashboard"));

    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toContain("/login");
    expect(mfaGetAALMock).not.toHaveBeenCalled();
  });

  it("libera rota protegida com sessão aal1 quando a conta não tem MFA", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    mfaGetAALMock.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" } });

    const { middleware } = await import("./middleware");
    const resposta = await middleware(request("/dashboard"));

    expect(resposta.status).toBe(200);
  });

  it("libera rota pública mesmo sem sessão", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { middleware } = await import("./middleware");
    const resposta = await middleware(request("/login"));

    expect(resposta.status).toBe(200);
    expect(mfaGetAALMock).not.toHaveBeenCalled();
  });

  it("barra rota protegida quando a conta tem MFA mas a sessão ainda é aal1", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    mfaGetAALMock.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" } });

    const { middleware } = await import("./middleware");
    const resposta = await middleware(request("/dashboard"));

    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toContain("/login");
  });

  it("libera rota protegida quando a sessão já chegou a aal2", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    mfaGetAALMock.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" } });

    const { middleware } = await import("./middleware");
    const resposta = await middleware(request("/dashboard"));

    expect(resposta.status).toBe(200);
  });

  it("não checa AAL em rota pública, mesmo com sessão aal1 pendente de MFA", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const { middleware } = await import("./middleware");
    const resposta = await middleware(request("/login"));

    expect(resposta.status).toBe(200);
    expect(mfaGetAALMock).not.toHaveBeenCalled();
  });

  // Incidente 2026-09-07: Supabase lento sem timeout no middleware travava a
  // função até o Vercel matar por inteiro (504 MIDDLEWARE_INVOCATION_TIMEOUT),
  // derrubando o site pra todo mundo com sessão ativa. Fail-open aqui é
  // seguro porque quem não tem sessão de verdade esbarra no RLS ao ler dados.
  it("libera a requisição (fail-open) quando getUser() do Supabase não responde a tempo", async () => {
    vi.useFakeTimers();
    getUserMock.mockReturnValue(new Promise(() => {})); // nunca resolve

    const { middleware } = await import("./middleware");
    const respostaPromise = middleware(request("/dashboard"));
    await vi.advanceTimersByTimeAsync(3000);
    const resposta = await respostaPromise;

    expect(resposta.status).toBe(200);
    vi.useRealTimers();
  });
});
