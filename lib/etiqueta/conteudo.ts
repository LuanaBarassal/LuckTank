// Texto impresso na etiqueta do QR do veículo — um só lugar pra página de
// impressão (app/(escritorio)/onibus/[id]/etiqueta) e pro PDF gerado no
// servidor (lib/etiqueta/pdf.ts), pra os dois nunca divergirem. Gerado a
// partir do fluxo real do motorista (components/motorista/fluxo-abastecimento.tsx):
// são as telas que ele vê, na ordem em que aparecem — captura guiada de 4
// fotos (bomba → cupom → hodômetro → nota fiscal), bomba/hodômetro/nota
// podem ser puladas.
export const PASSOS_MOTORISTA = [
  "Escaneie o QR Code — ele abre o sistema de abastecimento, sem senha.",
  'Toque no seu nome na lista (ou em "Meu nome não está na lista" e digite).',
  "Fotografe o visor da bomba mostrando litros e valor (ou pule, se não der pra fotografar).",
  "Tire uma foto legível do comprovante/cupom do abastecimento, ou escolha uma da galeria.",
  "Fotografe o painel/hodômetro mostrando o KM atual (ou pule, se não der pra fotografar).",
  "Fotografe a nota fiscal eletrônica pedida no CNPJ da empresa (ou pule, se o posto não entregou agora).",
  "Confira os dados preenchidos automaticamente (ou preencha à mão) e confirme o KM atual do veículo.",
  'Toque em "Confirmar abastecimento". Pronto — o registro já chega ao escritório.',
] as const;

export const AVISO_OFFLINE =
  "Sem internet? Preencha os dados manualmente — o abastecimento é salvo no aparelho e enviado assim que a conexão voltar.";
