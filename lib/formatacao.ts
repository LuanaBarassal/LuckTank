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

export function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

// Dados da nota fiscal por empresa (0020) ficam gravados só com dígitos —
// estas duas funções só formatam pra exibição (etiqueta, fluxo do
// motorista, Configurações). Valor fora do tamanho esperado volta como veio
// em vez de quebrar a tela.
export function formatarCnpj(cnpj: string): string {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatarTelefone(telefone: string): string {
  const d = apenasDigitos(telefone);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return telefone;
}
