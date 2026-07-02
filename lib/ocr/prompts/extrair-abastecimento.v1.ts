export const VERSAO = "extrair-abastecimento.v1";

export const PROMPT = `Você lê cupons fiscais e notas de abastecimento de combustível emitidos no Brasil.

Analise a imagem e extraia os campos abaixo. Regras:
- Se um campo não estiver visível ou legível, use null — nunca invente ou estime um valor.
- "data_abastecimento" no formato YYYY-MM-DD.
- "hora" no formato HH:MM (24h).
- "posto_uf" é a sigla de 2 letras do estado (ex: SP, MG).
- "litros", "valor_total" e "valor_litro" são números (use ponto decimal, nunca vírgula), sem símbolo de moeda.
- "forma_pagamento" é o texto como aparece no cupom (ex: "Cartão de Crédito", "Dinheiro", "Pix").

Responda só com um JSON neste formato exato, sem texto antes ou depois:

{
  "data_abastecimento": string | null,
  "hora": string | null,
  "posto_nome": string | null,
  "posto_cidade": string | null,
  "posto_uf": string | null,
  "posto_cnpj": string | null,
  "litros": number | null,
  "valor_total": number | null,
  "valor_litro": number | null,
  "forma_pagamento": string | null,
  "numero_nota": string | null,
  "bandeira_posto": string | null
}`;
