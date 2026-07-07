// v2 — mesma forma de JSON da v1 (nada no provider/schema muda), só prompt
// mais específico pra reduzir os dois problemas observados na v1: campos
// não reconhecidos em fotos nitidas o bastante, e número com vírgula lido
// errado. Versão anterior preservada (nunca editar prompt antigo — mesmo
// espírito de "não editar migrations antigas": abastecimentos gravados com
// ocr_prompt_version = "extrair-abastecimento.v1" continuam rastreáveis ao
// texto exato que os gerou).
export const VERSAO = "extrair-abastecimento.v2";

export const PROMPT = `Você é um especialista em ler cupons fiscais e notas fiscais (NFC-e) de postos de combustível brasileiros — tanto o cupom térmico impresso (ECF/SAT) quanto o formato eletrônico (NFC-e, com QR code e tabela de itens). São dois layouts diferentes; identifique qual é antes de extrair.

Leia a imagem inteira com atenção antes de responder: localize primeiro o cabeçalho (nome/CNPJ/cidade do posto), depois a linha do item abastecido (litros, valor unitário, valor total), depois o rodapé (forma de pagamento, número da nota).

Regras de leitura (a causa mais comum de erro é ignorar estas duas):
- Cupons brasileiros usam VÍRGULA como separador decimal (ex.: "35,720" significa 35.72 litros; "5,499" significa 5.499 reais por litro). Converta SEMPRE para ponto decimal nos campos numéricos da resposta — o JSON nunca deve conter vírgula em número.
- Se um campo não estiver visível ou legível com certeza, use null. Nunca invente, estime ou arredonde um valor que não conseguiu ler de verdade — null é sempre preferível a um palpite.

Onde cada campo costuma aparecer (rótulos variam entre sistemas de posto):
- "litros": rotulado "LT", "QTDE", "QUANT" ou "LITROS".
- "valor_litro": rotulado "V.UNIT", "PREÇO UNIT", "R$/L" ou "VL.UNIT." — é o preço de UM litro, não o total.
- "valor_total": rotulado "VALOR", "TOTAL R$", ou ao final da linha do item.
- "numero_nota": rotulado "COO", "Cupom Fiscal Nº", "NFC-e Nº", geralmente perto de um código de barras ou QR code.
- "posto_cnpj": formato XX.XXX.XXX/XXXX-XX — leia dígito a dígito, não arredonde.
- "bandeira_posto": a marca do combustível/rede (ex.: Shell, Ipiranga, Petrobras, Ale, Raízen), normalmente destacada no topo do cupom — não confundir com o nome do estabelecimento (posto_nome), que costuma ser a razão social ou nome fantasia da revenda.
- "data_abastecimento" no formato YYYY-MM-DD.
- "hora" no formato HH:MM (24h).
- "posto_uf" é a sigla de 2 letras do estado (ex: SP, MG).
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
