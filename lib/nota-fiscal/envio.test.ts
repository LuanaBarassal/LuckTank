import { describe, expect, it } from "vitest";
import {
  montarAssuntoNotaFiscal,
  montarMensagemNotaFiscal,
  linkWhatsappNotaFiscal,
  linkEmailNotaFiscal,
} from "./envio";

const DADOS = {
  veiculo: "1450 · EXM1A23",
  dataAbastecimento: "2026-09-23",
  valorTotal: 612.5,
  litros: 102.3,
  motorista: "João da Silva",
};

describe("mensagem da nota fiscal", () => {
  it("monta a mensagem com veículo, data, valor, litros e motorista", () => {
    const mensagem = montarMensagemNotaFiscal(DADOS);
    expect(mensagem).toContain("Veículo: 1450 · EXM1A23");
    expect(mensagem).toContain("Data: 23/09/2026");
    expect(mensagem).toMatch(/Valor: R\$\s612,50/);
    expect(mensagem).toContain("Litros: 102.3 L");
    expect(mensagem).toContain("Motorista: João da Silva");
    // Padrão (WhatsApp/e-mail, sem anexo): instrui, nunca afirma que anexou.
    expect(mensagem).toContain("Anexe a foto da nota fiscal a esta mensagem.");
    expect(mensagem).not.toContain("em anexo");
  });

  it("omite o que não tem (sem 'null' na mensagem)", () => {
    const mensagem = montarMensagemNotaFiscal({ ...DADOS, valorTotal: null, litros: null, motorista: null });
    expect(mensagem).not.toContain("null");
    expect(mensagem).not.toContain("Valor:");
    expect(mensagem).not.toContain("Motorista:");
  });

  it("assunto com veículo e data", () => {
    expect(montarAssuntoNotaFiscal(DADOS)).toBe("Nota fiscal - abastecimento 1450 · EXM1A23 - 23/09/2026");
  });
});

describe("links de envio", () => {
  it("WhatsApp: wa.me com 55 + número e texto codificado", () => {
    const link = linkWhatsappNotaFiscal("13974064858", "Olá mundo\nlinha 2");
    expect(link).toBe("https://wa.me/5513974064858?text=Ol%C3%A1%20mundo%0Alinha%202");
  });

  it("e-mail: mailto com assunto e corpo, espaço como %20 (não +)", () => {
    const link = linkEmailNotaFiscal("expressomundialturismo@gmail.com", "Nota fiscal", "a b");
    expect(link).toBe("mailto:expressomundialturismo@gmail.com?subject=Nota%20fiscal&body=a%20b");
  });
});

describe("mensagem com a foto anexada de verdade (Compartilhar)", () => {
  it("só afirma 'em anexo' quando fotoAnexada = true", () => {
    const mensagem = montarMensagemNotaFiscal(DADOS, true);
    expect(mensagem).toContain("Foto da nota fiscal em anexo.");
    expect(mensagem).not.toContain("Anexe a foto");
  });
});
