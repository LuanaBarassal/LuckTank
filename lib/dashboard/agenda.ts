// Agenda (calendário) de abastecimentos — função pura (mesmo padrão de
// agregacoes.ts/regras.ts: sem query aqui dentro, só recebe a lista já
// buscada do mês e monta a grade). Trabalha inteiramente em UTC (mesmo
// motivo de lib/filtros/periodo.ts: evitar misturar fuso do servidor com a
// string "YYYY-MM-DD" comparada lexicamente contra a coluna `date` do
// Postgres).

export interface AbastecimentoAgenda {
  id: string;
  data_abastecimento: string; // "YYYY-MM-DD"
  hora: string | null;
  litros: number;
  valor_total: number;
  km_atual: number;
  km_rodado: number | null;
  consumo_kml: number | null;
  posto_nome: string | null;
  posto_cidade: string | null;
  posto_uf: string | null;
  forma_pagamento: string | null;
  numero_nota: string | null;
  bandeira_posto: string | null;
  veiculoNome: string;
  motoristaNome: string;
}

export interface DiaAgenda {
  data: string; // "YYYY-MM-DD"
  diaDoMes: number;
  noMesReferencia: boolean;
  itens: AbastecimentoAgenda[];
}

const REGEX_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function paraMesReferencia(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

// "YYYY-MM" vindo da URL (editável à mão pelo usuário) — fora do formato ou
// ausente cai no mês atual, nunca em erro. Mesmo espírito de
// parseFiltrosAbastecimento (lib/filtros/abastecimentos.ts).
export function resolverMesReferencia(mesParam: string | null, agora: Date = new Date()): string {
  if (mesParam && REGEX_MES.test(mesParam)) return mesParam;
  return paraMesReferencia(agora);
}

export function limitesDoMes(mesReferencia: string): { de: string; ate: string } {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 0)); // dia 0 do mês seguinte = último dia deste mês
  return { de: inicio.toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) };
}

export function mesAnterior(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  return paraMesReferencia(new Date(Date.UTC(ano, mes - 2, 1)));
}

export function proximoMes(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  return paraMesReferencia(new Date(Date.UTC(ano, mes, 1)));
}

// Grade fixa de 6 semanas (42 dias), começando no domingo da semana que
// contém o dia 1 do mês — cobre qualquer mês (pior caso: mês de 31 dias
// começando no sábado) sem a grade "pular" de altura entre meses diferentes.
// Dias fora do mês de referência (preenchendo a primeira/última semana)
// vêm marcados `noMesReferencia: false` — a página os exibe apagados.
export function montarGradeMes(
  mesReferencia: string,
  lista: AbastecimentoAgenda[]
): DiaAgenda[] {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const primeiroDiaDoMes = new Date(Date.UTC(ano, mes - 1, 1));
  const diaSemanaDoPrimeiro = primeiroDiaDoMes.getUTCDay(); // 0 = domingo

  const porDia = new Map<string, AbastecimentoAgenda[]>();
  for (const item of lista) {
    const itens = porDia.get(item.data_abastecimento) ?? [];
    itens.push(item);
    porDia.set(item.data_abastecimento, itens);
  }

  const dias: DiaAgenda[] = [];
  for (let i = 0; i < 42; i++) {
    const data = new Date(Date.UTC(ano, mes - 1, 1 - diaSemanaDoPrimeiro + i));
    const dataIso = data.toISOString().slice(0, 10);
    const itensNoDia = (porDia.get(dataIso) ?? []).slice().sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));

    dias.push({
      data: dataIso,
      diaDoMes: data.getUTCDate(),
      noMesReferencia: data.getUTCMonth() === mes - 1 && data.getUTCFullYear() === ano,
      itens: itensNoDia,
    });
  }
  return dias;
}
