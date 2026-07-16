import { describe, expect, it } from "vitest";
import { montarEmailAlertaCritico } from "./conteudo-alerta";

describe("montarEmailAlertaCritico", () => {
  it("usa singular no assunto quando só há 1 alerta", () => {
    const { assunto } = montarEmailAlertaCritico({
      veiculoLabel: "1450 · EXM1A23",
      tiposRegra: ["nota_fiscal_duplicada"],
      urlAlertas: "https://luck-tank.vercel.app/alertas",
    });
    expect(assunto).toBe("🔴 Alerta crítico — 1450 · EXM1A23");
  });

  it("usa plural com contagem quando há mais de 1 alerta", () => {
    const { assunto } = montarEmailAlertaCritico({
      veiculoLabel: "1450 · EXM1A23",
      tiposRegra: ["nota_fiscal_duplicada", "litros_acima_capacidade_tanque"],
      urlAlertas: "https://luck-tank.vercel.app/alertas",
    });
    expect(assunto).toBe("🔴 2 alertas críticos — 1450 · EXM1A23");
  });

  it("traduz tipo_regra pro rótulo legível no corpo", () => {
    const { html } = montarEmailAlertaCritico({
      veiculoLabel: "EXM1A23",
      tiposRegra: ["foto_comprovante_duplicada"],
      urlAlertas: "https://luck-tank.vercel.app/alertas",
    });
    expect(html).toContain("Foto do comprovante duplicada");
    expect(html).not.toContain("foto_comprovante_duplicada");
  });

  it("cai pro próprio código quando não há rótulo conhecido (nunca quebra)", () => {
    const { html } = montarEmailAlertaCritico({
      veiculoLabel: "EXM1A23",
      tiposRegra: ["regra_inexistente_no_mapa"],
      urlAlertas: "https://luck-tank.vercel.app/alertas",
    });
    expect(html).toContain("regra_inexistente_no_mapa");
  });

  it("escapa HTML no veiculoLabel", () => {
    const { html } = montarEmailAlertaCritico({
      veiculoLabel: `<img src=x onerror=alert(1)>`,
      tiposRegra: ["nota_fiscal_duplicada"],
      urlAlertas: "https://luck-tank.vercel.app/alertas",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("inclui o link do painel de alertas", () => {
    const { html } = montarEmailAlertaCritico({
      veiculoLabel: "EXM1A23",
      tiposRegra: ["nota_fiscal_duplicada"],
      urlAlertas: "https://luck-tank.vercel.app/alertas",
    });
    expect(html).toContain("https://luck-tank.vercel.app/alertas");
  });
});
