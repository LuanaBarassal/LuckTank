import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

function request(pathname: string) {
  return new NextRequest(new URL(pathname, "https://lucktank.exemplo"));
}

describe("middleware — barreira de sessão", () => {
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
  });

  it("libera rota protegida com sessão válida", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const { middleware } = await import("./middleware");
    const resposta = await middleware(request("/dashboard"));

    expect(resposta.status).toBe(200);
  });

  it("libera rota pública mesmo sem sessão", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { middleware } = await import("./middleware");
    const resposta = await middleware(request("/login"));

    expect(resposta.status).toBe(200);
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
