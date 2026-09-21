import { describe, expect, it, vi, beforeEach } from "vitest";

const getUsuarioAtualMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/auth/contexto-usuario", () => ({
  getUsuarioAtual: () => getUsuarioAtualMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Migration 0018 restringiu a policy de RLS de `alertas_update` a gerente/
// administrador. Este teste cobre a checagem espelhada na Server Action —
// existir aqui (além da policy no banco) é o que devolve um erro claro em
// vez de deixar o usuário levar um erro genérico de permissão do Postgres.
describe("resolverAlerta — checagem de papel (migration 0018)", () => {
  beforeEach(() => {
    getUsuarioAtualMock.mockReset();
    fromMock.mockReset();
    updateMock.mockReset();
    eqMock.mockReset();
    eqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });
  });

  it("recusa supervisor, sem chegar a chamar o banco", async () => {
    getUsuarioAtualMock.mockResolvedValue({
      id: "u1",
      empresa_id: "e1",
      nome: "Supervisor",
      email: "s@example.com",
      papel: "supervisor",
    });

    const { resolverAlerta } = await import("./actions");
    const resultado = await resolverAlerta("alerta-1");

    expect(resultado).toEqual({ error: "Só gerente ou administrador pode resolver um alerta." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("permite gerente", async () => {
    getUsuarioAtualMock.mockResolvedValue({
      id: "u2",
      empresa_id: "e1",
      nome: "Gerente",
      email: "g@example.com",
      papel: "gerente",
    });

    const { resolverAlerta } = await import("./actions");
    const resultado = await resolverAlerta("alerta-1");

    expect(resultado).toEqual({ data: true });
    expect(fromMock).toHaveBeenCalledWith("alertas");
  });

  it("permite administrador", async () => {
    getUsuarioAtualMock.mockResolvedValue({
      id: "u3",
      empresa_id: "e1",
      nome: "Admin",
      email: "a@example.com",
      papel: "administrador",
    });

    const { resolverAlerta } = await import("./actions");
    const resultado = await resolverAlerta("alerta-1");

    expect(resultado).toEqual({ data: true });
  });

  it("recusa sem sessão", async () => {
    getUsuarioAtualMock.mockResolvedValue(null);

    const { resolverAlerta } = await import("./actions");
    const resultado = await resolverAlerta("alerta-1");

    expect(resultado).toEqual({ error: "Não autenticado." });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
