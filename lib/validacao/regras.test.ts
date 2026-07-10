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
      valorTotal: 550,
      kmAtual: 150500,
      kmRodado: 500,
      consumoKml: 5,
      numeroNota: "123",
      dataAbastecimento: "2026-07-03",
    },
    veiculo: {
      capacidadeTanqueLitros: 300,
      consumoReferenciaKml: null,
    },
    notaDuplicada: false,
    fotoDuplicada: false,
    consumoMedioHistorico: 5,
    fotoExifTimestamp: null,
    bombaLitrosLido: null,
    bombaValorTotalLido: null,
    hodometroKmLido: null,
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

describe("avaliarConsumoForaDaReferenciaFabricante", () => {
  it("não dispara quando o veículo não tem consumo de referência cadastrado", () => {
    const ctx = contextoBase();
    ctx.abastecimento.consumoKml = 100; // desvio absurdo, mas sem referência não há o que comparar
    ctx.veiculo.consumoReferenciaKml = null;
    const alertas = avaliarAbastecimento(ctx);
    expect(
      alertas.find((a) => a.tipoRegra === "consumo_fora_da_referencia_fabricante")
    ).toBeUndefined();
  });

  it("não dispara dentro da tolerância de 35% de desvio", () => {
    const ctx = contextoBase();
    ctx.veiculo.consumoReferenciaKml = 8;
    ctx.abastecimento.consumoKml = 10; // desvio = 25%, dentro dos 35%
    const alertas = avaliarAbastecimento(ctx);
    expect(
      alertas.find((a) => a.tipoRegra === "consumo_fora_da_referencia_fabricante")
    ).toBeUndefined();
  });

  it("dispara atenção quando o consumo real é bem PIOR que a referência (>35%)", () => {
    const ctx = contextoBase();
    ctx.veiculo.consumoReferenciaKml = 8;
    ctx.abastecimento.consumoKml = 5; // desvio = 37.5%
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "consumo_fora_da_referencia_fabricante");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("atencao");
    expect(alerta?.detalhes).toEqual({
      consumo_kml: 5,
      consumo_referencia_kml: 8,
      desvio_percentual: 37.5,
    });
  });

  it("dispara atenção quando o consumo real é bem MELHOR que a referência (>35%) — possível litro subdeclarado", () => {
    const ctx = contextoBase();
    ctx.veiculo.consumoReferenciaKml = 8;
    ctx.abastecimento.consumoKml = 11; // desvio = 37.5%, no sentido "melhor"
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "consumo_fora_da_referencia_fabricante");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("atencao");
  });

  it("não dispara no limite exato de 35%", () => {
    const ctx = contextoBase();
    // 20 e 13 dão desvio de exatamente 0.35 em ponto flutuante (7/20 é
    // representável sem erro de arredondamento residual, diferente de
    // "8 * 1.35" que acumula um erro de ~1e-16 e cruzaria o limiar).
    ctx.veiculo.consumoReferenciaKml = 20;
    ctx.abastecimento.consumoKml = 13;
    const alertas = avaliarAbastecimento(ctx);
    expect(
      alertas.find((a) => a.tipoRegra === "consumo_fora_da_referencia_fabricante")
    ).toBeUndefined();
  });

  it("não dispara quando o próprio abastecimento não tem consumo calculável", () => {
    const ctx = contextoBase();
    ctx.veiculo.consumoReferenciaKml = 8;
    ctx.abastecimento.consumoKml = null;
    const alertas = avaliarAbastecimento(ctx);
    expect(
      alertas.find((a) => a.tipoRegra === "consumo_fora_da_referencia_fabricante")
    ).toBeUndefined();
  });

  it("trata consumo_referencia_kml <= 0 como 'não cadastrado' (dado inválido não deve disparar)", () => {
    const ctx = contextoBase();
    ctx.veiculo.consumoReferenciaKml = 0;
    ctx.abastecimento.consumoKml = 100;
    const alertas = avaliarAbastecimento(ctx);
    expect(
      alertas.find((a) => a.tipoRegra === "consumo_fora_da_referencia_fabricante")
    ).toBeUndefined();
  });

  it("dispara JUNTO com consumo_fora_da_faixa_historica pro mesmo evento (complementares, não exclusivas)", () => {
    const ctx = contextoBase();
    ctx.consumoMedioHistorico = 8; // regra histórica também vai disparar
    ctx.veiculo.consumoReferenciaKml = 8;
    ctx.abastecimento.consumoKml = 33; // foge muito das duas bases de comparação
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.map((a) => a.tipoRegra).sort()).toEqual(
      ["consumo_fora_da_faixa_historica", "consumo_fora_da_referencia_fabricante"].sort()
    );
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

describe("avaliarFotoAntigaOuReaproveitada", () => {
  it("não dispara quando a foto não tem EXIF (sem metadado, sem penalidade)", () => {
    const ctx = contextoBase();
    ctx.fotoExifTimestamp = null;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "foto_antiga_ou_reaproveitada")).toBeUndefined();
  });

  it("não dispara quando o EXIF é coerente com a data informada (mesmo dia)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.dataAbastecimento = "2026-07-03";
    ctx.fotoExifTimestamp = "2026-07-03T14:00:00.000Z";
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "foto_antiga_ou_reaproveitada")).toBeUndefined();
  });

  it("não dispara dentro da tolerância de 48h", () => {
    const ctx = contextoBase();
    ctx.abastecimento.dataAbastecimento = "2026-07-03";
    ctx.fotoExifTimestamp = "2026-07-01T23:59:59.000Z"; // ~48h antes do fim do dia informado
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "foto_antiga_ou_reaproveitada")).toBeUndefined();
  });

  it("dispara atenção quando o EXIF é bem mais antigo que a data informada (>48h)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.dataAbastecimento = "2026-07-03";
    ctx.fotoExifTimestamp = "2026-06-01T10:00:00.000Z"; // mais de um mês antes
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "foto_antiga_ou_reaproveitada");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("atencao");
  });

  it("não dispara quando a foto é DEPOIS da data informada (registro atrasado, fluxo legítimo)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.dataAbastecimento = "2026-06-01";
    ctx.fotoExifTimestamp = "2026-07-03T10:00:00.000Z"; // foto tirada 'hoje', data informada é de um mês antes
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "foto_antiga_ou_reaproveitada")).toBeUndefined();
  });

  it("não lança e não dispara com timestamp EXIF malformado", () => {
    const ctx = contextoBase();
    ctx.fotoExifTimestamp = "não é uma data";
    expect(() => avaliarAbastecimento(ctx)).not.toThrow();
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "foto_antiga_ou_reaproveitada")).toBeUndefined();
  });
});

describe("avaliarDivergenciaBombaCupomLitros", () => {
  it("não dispara quando não há foto da bomba (null nunca é fraude)", () => {
    const ctx = contextoBase();
    ctx.bombaLitrosLido = null;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "divergencia_bomba_cupom_litros")).toBeUndefined();
  });

  it("não dispara quando os valores são idênticos", () => {
    const ctx = contextoBase();
    ctx.bombaLitrosLido = ctx.abastecimento.litros;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "divergencia_bomba_cupom_litros")).toBeUndefined();
  });

  it("não dispara no limite exato da tolerância (100 litros no cupom, 2% = 2L)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.litros = 100;
    ctx.bombaLitrosLido = 102; // exatamente 2L de diferença — limite exato não dispara
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "divergencia_bomba_cupom_litros")).toBeUndefined();
  });

  it("dispara atenção acima da tolerância percentual", () => {
    const ctx = contextoBase();
    ctx.abastecimento.litros = 100;
    ctx.bombaLitrosLido = 110; // 10L de diferença, bem acima dos 2L de tolerância
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "divergencia_bomba_cupom_litros");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("atencao");
    expect(alerta?.detalhes).toEqual({ litros_bomba: 110, litros_cupom: 100, divergencia: 10 });
  });

  it("dispara acima da tolerância ABSOLUTA mesmo em abastecimento pequeno (piso de 0.5L)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.litros = 5; // 2% de 5L seria só 0.1L — usa o piso de 0.5L
    ctx.bombaLitrosLido = 6; // 1L de diferença, acima do piso de 0.5L
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "divergencia_bomba_cupom_litros")).toBeDefined();
  });
});

describe("avaliarDivergenciaBombaCupomValor", () => {
  it("não dispara quando não há foto da bomba", () => {
    const ctx = contextoBase();
    ctx.bombaValorTotalLido = null;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "divergencia_bomba_cupom_valor")).toBeUndefined();
  });

  it("não dispara quando os valores são idênticos", () => {
    const ctx = contextoBase();
    ctx.bombaValorTotalLido = ctx.abastecimento.valorTotal;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "divergencia_bomba_cupom_valor")).toBeUndefined();
  });

  it("não dispara dentro da tolerância", () => {
    const ctx = contextoBase();
    ctx.abastecimento.valorTotal = 550;
    ctx.bombaValorTotalLido = 561; // R$11 de diferença, 2% de 550 = R$11 — limite exato não dispara
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "divergencia_bomba_cupom_valor")).toBeUndefined();
  });

  it("dispara atenção acima da tolerância percentual", () => {
    const ctx = contextoBase();
    ctx.abastecimento.valorTotal = 550;
    ctx.bombaValorTotalLido = 600; // R$50 de diferença
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "divergencia_bomba_cupom_valor");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("atencao");
    expect(alerta?.detalhes).toEqual({ valor_bomba: 600, valor_cupom: 550, divergencia: 50 });
  });

  it("dispara acima da tolerância ABSOLUTA mesmo em abastecimento pequeno (piso de R$2)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.valorTotal = 20; // 2% de R$20 seria só R$0,40 — usa o piso de R$2
    ctx.bombaValorTotalLido = 23; // R$3 de diferença, acima do piso de R$2
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "divergencia_bomba_cupom_valor")).toBeDefined();
  });
});

describe("avaliarKmHodometroDivergeDoConfirmado", () => {
  it("não dispara quando não há foto do hodômetro", () => {
    const ctx = contextoBase();
    ctx.hodometroKmLido = null;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "km_hodometro_diverge_do_confirmado")).toBeUndefined();
  });

  it("não dispara quando os valores são idênticos", () => {
    const ctx = contextoBase();
    ctx.hodometroKmLido = ctx.abastecimento.kmAtual;
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "km_hodometro_diverge_do_confirmado")).toBeUndefined();
  });

  it("não dispara dentro da tolerância (motorista corrigindo uma leitura de OCR levemente errada)", () => {
    const ctx = contextoBase();
    ctx.abastecimento.kmAtual = 150500;
    ctx.hodometroKmLido = 150480; // 20km de diferença, dentro dos 50km de tolerância
    const alertas = avaliarAbastecimento(ctx);
    expect(alertas.find((a) => a.tipoRegra === "km_hodometro_diverge_do_confirmado")).toBeUndefined();
  });

  it("dispara atenção acima da tolerância de 50km", () => {
    const ctx = contextoBase();
    ctx.abastecimento.kmAtual = 150500;
    ctx.hodometroKmLido = 150300; // 200km de diferença
    const alertas = avaliarAbastecimento(ctx);
    const alerta = alertas.find((a) => a.tipoRegra === "km_hodometro_diverge_do_confirmado");
    expect(alerta).toBeDefined();
    expect(alerta?.nivel).toBe("atencao");
    expect(alerta?.detalhes).toEqual({ km_hodometro: 150300, km_confirmado: 150500, divergencia: 200 });
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
