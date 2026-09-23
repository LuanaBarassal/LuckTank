import { describe, expect, it } from "vitest";
import { cnpjValido, dadosNotaFiscalSchema } from "./schemas";

describe("cnpjValido", () => {
  it("aceita o CNPJ do cliente piloto (dígito verificador confere)", () => {
    expect(cnpjValido("18785716000107")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(cnpjValido("18785716000108")).toBe(false);
  });

  it("recusa sequência repetida e tamanho errado", () => {
    expect(cnpjValido("00000000000000")).toBe(false);
    expect(cnpjValido("1878571600010")).toBe(false);
  });
});

describe("dadosNotaFiscalSchema", () => {
  it("normaliza o que a pessoa digita pra só dígitos", () => {
    const resultado = dadosNotaFiscalSchema.parse({
      cnpj: "18.785.716/0001-07",
      whatsapp: "(13) 97406-4858",
      email: " expressomundialturismo@gmail.com ",
    });
    expect(resultado).toEqual({
      cnpj: "18785716000107",
      whatsapp: "13974064858",
      email: "expressomundialturismo@gmail.com",
    });
  });

  it("tira o 55 do país se vier junto (o link do WhatsApp adiciona depois)", () => {
    expect(dadosNotaFiscalSchema.parse({ cnpj: null, whatsapp: "+55 13 97406-4858", email: null }).whatsapp).toBe(
      "13974064858"
    );
  });

  it("campo vazio vira null (limpa o campo)", () => {
    expect(dadosNotaFiscalSchema.parse({ cnpj: "", whatsapp: "  ", email: "" })).toEqual({
      cnpj: null,
      whatsapp: null,
      email: null,
    });
  });

  it("recusa CNPJ, WhatsApp ou e-mail inválidos", () => {
    expect(dadosNotaFiscalSchema.safeParse({ cnpj: "11.111.111/1111-11", whatsapp: null, email: null }).success).toBe(
      false
    );
    expect(dadosNotaFiscalSchema.safeParse({ cnpj: null, whatsapp: "97406", email: null }).success).toBe(false);
    expect(dadosNotaFiscalSchema.safeParse({ cnpj: null, whatsapp: null, email: "sem-arroba" }).success).toBe(false);
  });
});
