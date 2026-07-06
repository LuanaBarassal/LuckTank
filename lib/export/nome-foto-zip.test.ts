import { describe, expect, it } from "vitest";
import { gerarNomeFotoZip } from "./nome-foto-zip";

describe("gerarNomeFotoZip", () => {
  it("gera nome combinando data, veículo e motorista", () => {
    const nomes = new Map<string, number>();
    // "1450 · EXM1A23" é UM segmento só (veiculoLabel já formatado) — o "·"
    // interno some junto, igual a qualquer outro caractere não alfanumérico.
    expect(gerarNomeFotoZip("2026-07-03", "1450 · EXM1A23", "Marcos Vieira", "jpg", nomes)).toBe(
      "20260703_1450EXM1A23_MarcosVieira.jpg"
    );
  });

  it("deduplica quando duas fotos gerariam o mesmo nome-base (mesmo veículo/motorista/dia)", () => {
    const nomes = new Map<string, number>();
    const primeiro = gerarNomeFotoZip("2026-07-03", "1450 · EXM1A23", "Marcos Vieira", "jpg", nomes);
    const segundo = gerarNomeFotoZip("2026-07-03", "1450 · EXM1A23", "Marcos Vieira", "jpg", nomes);
    const terceiro = gerarNomeFotoZip("2026-07-03", "1450 · EXM1A23", "Marcos Vieira", "jpg", nomes);
    expect(primeiro).not.toBe(segundo);
    expect(new Set([primeiro, segundo, terceiro]).size).toBe(3);
    expect(segundo.endsWith("-2.jpg")).toBe(true);
    expect(terceiro.endsWith("-3.jpg")).toBe(true);
  });

  it("mantém o Map compartilhado entre extensões diferentes sem colidir", () => {
    const nomes = new Map<string, number>();
    const jpg = gerarNomeFotoZip("2026-07-03", "1450 · EXM1A23", "Marcos Vieira", "jpg", nomes);
    const heic = gerarNomeFotoZip("2026-07-03", "1450 · EXM1A23", "Marcos Vieira", "heic", nomes);
    // Extensões diferentes não são a "mesma chave" — nenhuma das duas deve
    // ganhar sufixo de deduplicação.
    expect(jpg.includes("-2")).toBe(false);
    expect(heic.includes("-2")).toBe(false);
  });

  it("usa 'comprovante' como base quando data/veículo/motorista normalizam pra vazio", () => {
    const nomes = new Map<string, number>();
    expect(gerarNomeFotoZip("", "", "", "jpg", nomes)).toBe("comprovante.jpg");
  });
});
