// Agregações do dashboard — funções puras (sem query aqui dentro), mesmo
// padrão de lib/validacao/regras.ts: o Server Component busca os dados
// brutos e chama isto pra transformar em séries prontas pros gráficos.

export interface AbastecimentoAgregavel {
  data_abastecimento: string;
  litros: number;
  valor_total: number;
  consumo_kml: number | null;
  veiculo_id: string;
  motorista_id: string | null;
  motorista_nome_livre: string | null;
  posto_nome: string | null;
}

function formatarDataCurta(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}

export function agregarGastoPorDia(lista: AbastecimentoAgregavel[]) {
  const porDia = new Map<string, number>();
  for (const a of lista) {
    porDia.set(a.data_abastecimento, (porDia.get(a.data_abastecimento) ?? 0) + a.valor_total);
  }

  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, valor]) => ({ data: formatarDataCurta(data), valor: Number(valor.toFixed(2)) }));
}

export function agregarPrecoMedioPorDia(lista: AbastecimentoAgregavel[]) {
  const litrosPorDia = new Map<string, number>();
  const valorPorDia = new Map<string, number>();

  for (const a of lista) {
    litrosPorDia.set(a.data_abastecimento, (litrosPorDia.get(a.data_abastecimento) ?? 0) + a.litros);
    valorPorDia.set(a.data_abastecimento, (valorPorDia.get(a.data_abastecimento) ?? 0) + a.valor_total);
  }

  return [...litrosPorDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, litros]) => {
      const valor = valorPorDia.get(data) ?? 0;
      return {
        data: formatarDataCurta(data),
        precoMedio: litros > 0 ? Number((valor / litros).toFixed(2)) : 0,
      };
    });
}

function agregarConsumoMedio(
  lista: AbastecimentoAgregavel[],
  chaveDe: (a: AbastecimentoAgregavel) => string,
  nomeDe: (chave: string) => string
) {
  const somas = new Map<string, { soma: number; quantidade: number }>();

  for (const a of lista) {
    if (a.consumo_kml == null) continue;
    const chave = chaveDe(a);
    const atual = somas.get(chave) ?? { soma: 0, quantidade: 0 };
    somas.set(chave, { soma: atual.soma + a.consumo_kml, quantidade: atual.quantidade + 1 });
  }

  return [...somas.entries()]
    .map(([chave, { soma, quantidade }]) => ({
      nome: nomeDe(chave),
      consumoMedio: Number((soma / quantidade).toFixed(2)),
    }))
    .sort((a, b) => b.consumoMedio - a.consumoMedio);
}

export function agregarConsumoPorVeiculo(
  lista: AbastecimentoAgregavel[],
  mapaPlacas: Map<string, string>
) {
  return agregarConsumoMedio(
    lista,
    (a) => a.veiculo_id,
    (id) => mapaPlacas.get(id) ?? "Desconhecido"
  );
}

export function agregarConsumoPorMotorista(
  lista: AbastecimentoAgregavel[],
  mapaMotoristas: Map<string, string>
) {
  return agregarConsumoMedio(
    lista,
    (a) => a.motorista_id ?? `livre:${a.motorista_nome_livre ?? "Não informado"}`,
    (chave) => (chave.startsWith("livre:") ? chave.slice(6) : mapaMotoristas.get(chave) ?? "Desconhecido")
  );
}

export function agregarPostosUtilizados(lista: AbastecimentoAgregavel[]) {
  const contagem = new Map<string, number>();
  for (const a of lista) {
    const nome = a.posto_nome?.trim() || "Não informado";
    contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([posto, quantidade]) => ({ posto, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);
}
