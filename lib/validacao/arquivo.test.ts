import { describe, expect, it } from "vitest";
import { validarArquivoNotaFiscal, TAMANHO_MAXIMO_PDF_NOTA_BYTES } from "./arquivo";

function arquivo(bytes: number[], tamanhoTotal: number, tipo: string) {
  const buffer = Buffer.alloc(tamanhoTotal);
  Buffer.from(bytes).copy(buffer);
  const file = new File([buffer], "qualquer-nome", { type: tipo });
  return { file, buffer };
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]; // "%PDF-1.7"

describe("validarArquivoNotaFiscal", () => {
  it("aceita foto JPEG como nota", () => {
    const { file, buffer } = arquivo(JPEG, 1024, "image/jpeg");
    expect(validarArquivoNotaFiscal(file, buffer)).toEqual({
      valido: true,
      extensao: "jpg",
      contentType: "image/jpeg",
    });
  });

  it("aceita PDF pela assinatura, mesmo com tipo declarado errado", () => {
    const { file, buffer } = arquivo(PDF, 1024, "image/jpeg");
    expect(validarArquivoNotaFiscal(file, buffer)).toEqual({
      valido: true,
      extensao: "pdf",
      contentType: "application/pdf",
    });
  });

  it("recusa PDF acima do teto", () => {
    const { file, buffer } = arquivo(PDF, TAMANHO_MAXIMO_PDF_NOTA_BYTES + 1, "application/pdf");
    expect(validarArquivoNotaFiscal(file, buffer)).toEqual({
      valido: false,
      erro: "PDF muito grande (máximo 4MB).",
    });
  });

  it("recusa arquivo que não é foto nem PDF (ex.: XML da NF-e ou executável)", () => {
    const { file, buffer } = arquivo([0x3c, 0x3f, 0x78, 0x6d, 0x6c], 1024, "application/pdf");
    expect(validarArquivoNotaFiscal(file, buffer)).toEqual({
      valido: false,
      erro: "Envie uma foto ou um PDF da nota.",
    });
  });

  it("recusa arquivo vazio", () => {
    const { file, buffer } = arquivo([], 0, "image/jpeg");
    expect(validarArquivoNotaFiscal(file, buffer).valido).toBe(false);
  });
});
