import { describe, expect, it } from "vitest";
import {
  avaliarAbastecimento,
  kmMenorQueUltimoRegistrado,
  type ContextoAvaliacao,
} from "./regras";

// Trava o comportamento ATUAL do motor de validação (Fase 6): qualquer
// mudança futura nos limiares (25% de desvio, 1 km/L mínimo, etc.) precisa
// fazer um teste daqui quebrar de propósito, nunca passar batido. Números
// espelham os cenários reais testados contra o endpoint na Fase 6 (ver
// PROJETO.md) sempre que possível, pra ficar ancorado em caso conhecido.

function contextoBase(): ContextoAvaliacao {
  return {
    abastecimento: {
      litros: 100,
      kmRodado: 500,
      consumoKml: 5,
      numeroNota: "123",
    },
    veiculo: {
      capacidadeTanqueLitros: 300,
    },
    notaDuplicada: false,
    fotoDuplicada: false,
    consumoMedioHistorico: 5,
  };
}

describe("avaliarCapacidadeTanque", () => {
  it("dispara crítico quando litros excede a capacidade do tanque (350L > 300L)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.litros = 350;
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "litros_acima_capacidade_tanque");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("critico");
    expect(alerta?.detalhes).toEqual({ litros: 350, capacidade_tanque_litros: 300 });
  });

  it("não dispara quando litros é igual à capacidade (limite exato, não é 'maior que')", () => {
    const ctx = contextoBase();
    ctx.abastecimento.litros = 300;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "litros_acima_capacidade_tanque")).toBeUndefined();
  });

  it("não dispara quando o veículo não tem capacidade de tanque cadastrada", () => {
    const ctx = contextoBase();
    ctx.abastecimento.litros = 9999;
    ctx.veiculo.capacidadeTanqueLitros = null;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "litros_acima_capacidade_tanque")).toBeUndefined();
  });
});

describe("avaliarNotaDuplicada", () => {
  it("dispara crítico quando notaDuplicada é true", () => {
    const ctx = contextoBase();
    ctx.notaDuplicada = true;
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "nota_fiscal_duplicada");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("critico");
  });

  it("não dispara quando notaDuplicada é false", () => {
    const ctx = contextoBase();
    ctx.notaDuplicada = false;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "nota_fiscal_duplicada")).toBeUndefined();
  });
});

describe("avaliarFotoDuplicada", () => {
  it("dispara crítico quando fotoDuplicada é true", () => {
    const ctx = contextoBase();
    ctx.fotoDuplicada = true;
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "foto_comprovante_duplicada");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("critico");
  });

  it("não dispara quando fotoDuplicada é false", () => {
    const ctx = contextoBase();
    ctx.fotoDuplicada = false;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "foto_comprovante_duplicada")).toBeUndefined();
  });
});

describe("avaliarConsumoForaDaFaixa", () => {
  it("dispara atenção quando o consumo (33 km/L) foge >25% da média histórica", () => {
    const ctx = contextoBase();
    ctx.abastecimento.consumoKml = 33;
    ctx.consumoMedioHistorico = 8;
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "consumo_fora_da_faixa_historica");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("atencao");
    expect(alerta?.detalhes).toEqual({
      consumo_kml: 33,
      media_historica_kml: 8,
      desvio_percentual: 312.5,
    });
  });

  it("não dispara dentro da tolerância de 25% de desvio", () => {
    const ctx = contextoBase();
    ctx.abastecimento.consumoKml = 10;
    ctx.consumoMedioHistorico = 8; // desvio = 25% exato
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "consumo_fora_da_faixa_historica")).toBeUndefined();
  });

  it("dispara logo acima do limiar de 25% (desvio de 25.01%)", () => {
    const ctx = contextoBase();
    ctx.consumoMedioHistorico = 8;
    ctx.abastecimento.consumoKml = 8 * 1.2501; // pouco mais que 25% acima
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "consumo_fora_da_faixa_historica")).toBeDefined();
  });

  it("não dispara sem histórico de consumo (média null)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.consumoKml = 100;
    ctx.consumoMedioHistorico = null;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "consumo_fora_da_faixa_historica")).toBeUndefined();
  });

  it("não dispara quando o próprio abastecimento não tem consumo calculável", () => {
    const ctx = contextoBase();
    ctx.abastecimento.consumoKml = null;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "consumo_fora_da_faixa_historica")).toBeUndefined();
  });
});

describe("avaliarLitrosDesproporcionais", () => {
  it("dispara atenção quando o consumo implícito (0.2 km/L) é fisicamente implausível", () => {
    const ctx = contextoBase();
    ctx.abastecimento.kmRodado = 20;
    ctx.abastecimento.litros = 100; // 20/100 = 0.2 km/L
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "litros_desproporcionais_ao_km_rodado");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("atencao");
    expect(alerta?.detalhes).toEqual({
      km_rodado: 20,
      litros: 100,
      consumo_implicito_kml: 0.2,
    });
  });

  it("não dispara no limite exato de 1 km/L", () => {
    const ctx = contextoBase();
    ctx.abastecimento.kmRodado = 100;
    ctx.abastecimento.litros = 100; // exatamente 1 km/L
    const alertas = avaliarAbastecimento(ctx);
    expect(
      alertas.find((a) => a.tipoRegra === "litros_desproporcionais_ao_km_rodado")
    ).toBeUndefined();
  });

  it("não dispara quando não há km rodado (primeiro registro do veículo)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.kmRodado = null;
    const alertas = avaliarAbastecimento(ctx);
    expect(
      alertas.find((a) => a.tipoRegra === "litros_desproporcionais_ao_km_rodado")
    ).toBeUndefined();
  });
});

describe("avaliarAbastecimento — combinação de regras", () => {
  it("dispara capacidade do tanque E consumo fora da faixa juntos (não são mutuamente exclusivas)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.litros = 350; // > 300L capacidade
    ctx.abastecimento.consumoKml = 33;
    ctx.consumoMedioHistorico = 8;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.map((a) => a.tipoRegra).sort()).toEqual(
      ["consumo_fora_da_faixa_historica", "litros_acima_capacidade_tanque"].sort()
    );
  });

  it("não dispara nenhum alerta pra um abastecimento dentro de todos os limiares", () => {
    const alertas = avaliarAbastecimento(contextoBase());
    expect(alertas).toEqual([]);
  });
});

describe("kmMenorQueUltimoRegistrado (bloqueio real, invariante #6)", () => {
  it("bloqueia quando o km informado é menor que o último registrado", () => {
    expect(kmMenorQueUltimoRegistrado(149999, 150000)).toBe(true);
  });

  it("não bloqueia quando o km informado é igual ao último registrado", () => {
    expect(kmMenorQueUltimoRegistrado(150000, 150000)).toBe(false);
  });

  it("não bloqueia quando o km informado é maior que o último registrado", () => {
    expect(kmMenorQueUltimoRegistrado(150001, 150000)).toBe(false);
  });

  it("não bloqueia o primeiro abastecimento do veículo (sem km anterior)", () => {
    expect(kmMenorQueUltimoRegistrado(1, null)).toBe(false);
  });
});
