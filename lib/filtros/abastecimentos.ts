// Parsing e resolução dos filtros de abastecimento (data/veículo/motorista)
// vindos da URL (searchParams) — compartilhado entre o dashboard, a aba do
// ônibus e o export (Bloco 4), pra garantir que os três leiam exatamente o
// mesmo filtro do mesmo jeito. `parseFiltrosAbastecimento` nunca lança: URL é
// editável pelo usuário (inclusive à mão), então qualquer valor fora do
// formato esperado é tratado como ausente, nunca como erro 500.

import { calcularPeriodo } from "./periodo";

export interface FiltrosAbastecimento {
  de: string | null;
  ate: string | null;
  veiculoId: string | null;
  motoristaId: string | null;
  motoristaNomeLivre: string | null;
}

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SearchParamsPagina = Record<string, string | string[] | undefined>;

function campo(sp: SearchParamsPagina, chave: string): string | null {
  const valor = sp[chave];
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto && texto.length > 0 ? texto : null;
}

export function parseFiltrosAbastecimento(searchParams: SearchParamsPagina): FiltrosAbastecimento {
  const de = campo(searchParams, "de");
  const ate = campo(searchParams, "ate");
  const veiculoId = campo(searchParams, "veiculo_id");
  const motoristaId = campo(searchParams, "motorista_id");

  return {
    de: de && REGEX_DATA.test(de) ? de : null,
    ate: ate && REGEX_DATA.test(ate) ? ate : null,
    veiculoId: veiculoId && REGEX_UUID.test(veiculoId) ? veiculoId : null,
    motoristaId: motoristaId && REGEX_UUID.test(motoristaId) ? motoristaId : null,
    motoristaNomeLivre: campo(searchParams, "motorista_nome"),
  };
}

// Quando a URL não traz nenhum recorte de data, o período padrão é "este
// mês" (decisão de produto — ver PROJETO.md, Bloco 1 de filtros): sem isso,
// toda página abriria sem nenhum recorte, obrigando o usuário a filtrar toda
// vez só pra ver algo razoável. Se só um dos dois lados vier na URL, o outro
// fica aberto (1970-01-01 pra trás, hoje pra frente) em vez de forçar o mês.
export function resolverPeriodo(
  filtros: Pick<FiltrosAbastecimento, "de" | "ate">,
  agora: Date = new Date()
): { de: string; ate: string } {
  if (filtros.de || filtros.ate) {
    return {
      de: filtros.de ?? "1970-01-01",
      ate: filtros.ate ?? agora.toISOString().slice(0, 10),
    };
  }
  return calcularPeriodo("esteMes", agora);
}

// Aplica data + veículo + motorista numa query já construída (mesma cadeia
// de `.gte/.lte/.eq` usada nos 3 lugares que precisam concordar: dashboard,
// aba do ônibus e export). `any` interno é só implementação — a assinatura
// exportada preserva o tipo de entrada, então o chamador mantém o shape
// esperado do supabase-js.
export function aplicarFiltrosQuery<
  Q extends {
    gte: (coluna: string, valor: string) => Q;
    lte: (coluna: string, valor: string) => Q;
    eq: (coluna: string, valor: string) => Q;
  },
>(query: Q, filtros: FiltrosAbastecimento, periodo: { de: string; ate: string }): Q {
  let q = query.gte("data_abastecimento", periodo.de).lte("data_abastecimento", periodo.ate);
  if (filtros.veiculoId) q = q.eq("veiculo_id", filtros.veiculoId);
  if (filtros.motoristaId) q = q.eq("motorista_id", filtros.motoristaId);
  if (filtros.motoristaNomeLivre) q = q.eq("motorista_nome_livre", filtros.motoristaNomeLivre);
  return q;
}
