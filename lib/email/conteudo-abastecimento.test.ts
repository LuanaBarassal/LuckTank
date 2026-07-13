import { describe, expect, it } from "vitest";
import { montarEmailAbastecimentoRegistrado } from "./conteudo-abastecimento";

const BASE = {
  veiculoLabel: "1450 · EXM1A23",
  dataAbastecimento: "2026-07-13",
  hora: "14:30",
  motoristaLabel: "João da Silva",
  litros: 250,
  valorTotal: 1450,
  valorLitro: 5.8,
  postoNome: "Posto Central",
  postoCidade: "Curitiba",
  kmAtual: 150000,
  urlPainel: "https://luck-tank.vercel.app",
};

describe("montarEmailAbastecimentoRegistrado", () => {
  it("assunto identifica o veículo", () => {
    const { assunto } = montarEmailAbastecimentoRegistrado({ ...BASE, alertas: [] });
    expect(assunto).toBe("LuckTank · Abastecimento registrado — 1450 · EXM1A23");
  });

  it("corpo traz os dados principais do abastecimento", () => {
    const { html } = montarEmailAbastecimentoRegistrado({ ...BASE, alertas: [] });
    expect(html).toContain("João da Silva");
    expect(html).toContain("250 L");
    expect(html).toContain("Posto Central");
    expect(html).toContain("Curitiba");
    expect(html).toContain("150000");
    expect(html).toContain("13/07/2026 às 14:30");
  });

  it("sem alertas, não menciona nível nenhum nem o aviso de e-mail separado", () => {
    const { html } = montarEmailAbastecimentoRegistrado({ ...BASE, alertas: [] });
    expect(html).not.toContain("Crítico");
    expect(html).not.toContain("e-mail separado");
  });

  it("com alerta não-crítico, lista o alerta mas não menciona e-mail separado", () => {
    const { html } = montarEmailAbastecimentoRegistrado({
      ...BASE,
      alertas: [{ nivel: "atencao", tipoRegra: "consumo_fora_da_faixa_historica" }],
    });
    expect(html).toContain("Atenção");
    expect(html).toContain("Consumo fora da faixa histórica");
    expect(html).not.toContain("e-mail separado");
  });

  it("com alerta crítico, destaca o nível e avisa sobre o e-mail separado", () => {
    const { html } = montarEmailAbastecimentoRegistrado({
      ...BASE,
      alertas: [{ nivel: "critico", tipoRegra: "nota_fiscal_duplicada" }],
    });
    expect(html).toContain("Crítico");
    expect(html).toContain("Nota fiscal duplicada");
    expect(html).toContain("e-mail separado");
  });

  it("plural na contagem de alertas quando há mais de 1", () => {
    const { html } = montarEmailAbastecimentoRegistrado({
      ...BASE,
      alertas: [
        { nivel: "critico", tipoRegra: "nota_fiscal_duplicada" },
        { nivel: "atencao", tipoRegra: "consumo_fora_da_faixa_historica" },
      ],
    });
    expect(html).toContain("2 alertas");
  });

  it("cai pro próprio código quando não há rótulo conhecido", () => {
    const { html } = montarEmailAbastecimentoRegistrado({
      ...BASE,
      alertas: [{ nivel: "info", tipoRegra: "regra_inexistente_no_mapa" }],
    });
    expect(html).toContain("regra_inexistente_no_mapa");
  });

  it("omite a linha de valor por litro quando não informado", () => {
    const { html } = montarEmailAbastecimentoRegistrado({ ...BASE, valorLitro: null, alertas: [] });
    expect(html).not.toContain("Valor por litro");
  });

  it("link do botão vai pro dashboard sem alerta e pro painel de alertas com alerta", () => {
    const semAlerta = montarEmailAbastecimentoRegistrado({ ...BASE, alertas: [] });
    expect(semAlerta.html).toContain("https://luck-tank.vercel.app/dashboard");

    const comAlerta = montarEmailAbastecimentoRegistrado({
      ...BASE,
      alertas: [{ nivel: "info", tipoRegra: "x" }],
    });
    expect(comAlerta.html).toContain("https://luck-tank.vercel.app/alertas");
  });
});
