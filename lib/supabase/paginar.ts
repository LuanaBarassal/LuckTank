// Achado de auditoria (2026-07-20): nenhuma query de `abastecimentos`
// (dashboard, export Excel/PDF/ZIP) usava `.range()` explícito — o teto
// default do PostgREST (1000 linhas) podia truncar um relatório em silêncio
// pra uma empresa com histórico grande, sem qualquer aviso na tela ou no
// arquivo exportado. Grave justamente porque o produto existe pra auditoria
// financeira/anti-fraude.
//
// `buscarTodasLinhas` busca em páginas de `TAMANHO_PAGINA` via `.range()` até
// a página vir mais curta que o tamanho pedido (sinal de que acabou),
// concatenando tudo. `montarPagina` reconstrói a query do zero a cada
// chamada (o padrão usado em todo o resto do produto: aplicarFiltrosQuery
// recebe um builder novo) — nunca reaproveita um builder já `await`ado.
const TAMANHO_PAGINA = 1000;

export async function buscarTodasLinhas<T>(
  montarPagina: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const linhas: T[] = [];
  let inicio = 0;

  for (;;) {
    const { data, error } = await montarPagina(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw error;

    const pagina = data ?? [];
    linhas.push(...pagina);

    if (pagina.length < TAMANHO_PAGINA) break;
    inicio += TAMANHO_PAGINA;
  }

  return linhas;
}
