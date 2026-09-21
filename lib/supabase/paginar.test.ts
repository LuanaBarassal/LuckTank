import { describe, expect, it, vi } from "vitest";
import { buscarTodasLinhas } from "./paginar";

describe("buscarTodasLinhas", () => {
  it("devolve tudo numa página só quando cabe dentro do teto", async () => {
    const montarPagina = vi.fn(async (inicio: number) => ({
      data: inicio === 0 ? [{ id: 1 }, { id: 2 }, { id: 3 }] : [],
      error: null,
    }));

    const linhas = await buscarTodasLinhas(montarPagina);

    expect(linhas).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(montarPagina).toHaveBeenCalledTimes(1);
    expect(montarPagina).toHaveBeenCalledWith(0, 999);
  });

  it("concatena várias páginas até a última vir mais curta que o teto", async () => {
    // Simula 2.500 linhas reais com TAMANHO_PAGINA=1000 (valor interno do
    // módulo): 3 páginas (1000, 1000, 500) — é exatamente o cenário do
    // achado de auditoria (histórico grande truncado pelo teto do PostgREST).
    const totalLinhas = 2500;
    const todasAsLinhas = Array.from({ length: totalLinhas }, (_, i) => ({ id: i }));

    const montarPagina = vi.fn(async (inicio: number, fim: number) => ({
      data: todasAsLinhas.slice(inicio, fim + 1),
      error: null,
    }));

    const linhas = await buscarTodasLinhas(montarPagina);

    expect(linhas).toHaveLength(totalLinhas);
    expect(linhas).toEqual(todasAsLinhas);
    expect(montarPagina).toHaveBeenCalledTimes(3);
  });

  it("lança quando uma página devolve erro, sem engolir em silêncio", async () => {
    const montarPagina = vi.fn(async () => ({ data: null, error: new Error("falha de rede") }));

    await expect(buscarTodasLinhas(montarPagina)).rejects.toThrow("falha de rede");
  });

  it("trata data null como página vazia (encerra a paginação)", async () => {
    const montarPagina = vi.fn(async () => ({ data: null, error: null }));

    const linhas = await buscarTodasLinhas(montarPagina);

    expect(linhas).toEqual([]);
    expect(montarPagina).toHaveBeenCalledTimes(1);
  });
});
