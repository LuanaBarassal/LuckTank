const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarMoeda(valor: number): string {
  return formatadorMoeda.format(valor);
}

export function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Identificador operacional do veículo — na frota real, motorista e
// escritório se referem ao ônibus pelo PREFIXO (ex.: "1450"), não pela
// placa (que é só o dado legal). Prefixo é opcional (veículos já
// cadastrados antes dele existir não têm) — sem quebrar, cai pra só a
// placa.
export function formatarVeiculo(prefixo: string | null | undefined, placa: string): string {
  return prefixo ? `${prefixo} · ${placa}` : placa;
}
