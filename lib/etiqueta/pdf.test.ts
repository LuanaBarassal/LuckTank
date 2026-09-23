import { describe, expect, it } from "vitest";
import { gerarEtiquetaPdf } from "./pdf";

const URL_QR = "https://luck-tank.vercel.app/r/00000000-0000-4000-8000-000000000000";

// jsPDF grava o texto sem compressão — dá pra conferir o conteúdo direto no
// binário (cada linha vira um "(texto) Tj", com "(" ")" "\" escapados).
const textos = (pdf: Buffer) =>
  [...pdf.toString("latin1").matchAll(/\(((?:\\.|[^\\)])*)\) *Tj/g)]
    .map((m) => m[1].replace(/\\(.)/g, "$1"))
    .join(" | ");
const paginas = (pdf: Buffer) => Number(pdf.toString("latin1").match(/\/Count (\d+)/)?.[1]);

describe("gerarEtiquetaPdf", () => {
  it("cabe em UMA página A4 com identificador, passos e dados da NF completos", async () => {
    const pdf = gerarEtiquetaPdf({
      veiculoLabel: "1450 · EXM1A23",
      modeloAno: "Marcopolo Paradiso · 2019",
      qrUrl: URL_QR,
      notaFiscal: { cnpj: "18785716000107", whatsapp: "13974064858", email: "expressomundialturismo@gmail.com" },
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(paginas(pdf)).toBe(1);
    // A4 em pontos (595.28 × 841.89).
    expect(pdf.toString("latin1")).toMatch(/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
    const t = textos(pdf);
    // Identificador uma vez só.
    expect(t.match(/1450 · EXM1A23/g)).toHaveLength(1);
    expect(t).toContain("COMO ABASTECER");
    expect(t).toContain("DADOS PARA A");
    expect(t).toContain("18.785.716/0001-07");
    expect(t).toContain("(13) 97406-4858");
    expect(t).toContain("expressomundialturismo@gmail.com");
    // QR em vetor (retângulos preenchidos), sem imagem embutida — arquivo leve.
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");
    expect(pdf.length).toBeLessThan(150 * 1024);
  });

  it("empresa sem dados de NF: continua 1 página, sem o bloco", async () => {
    const pdf = gerarEtiquetaPdf({ veiculoLabel: "ABC1D23", modeloAno: null, qrUrl: URL_QR, notaFiscal: null });
    expect(paginas(pdf)).toBe(1);
    expect(textos(pdf)).not.toContain("DADOS PARA A");
  });
});
