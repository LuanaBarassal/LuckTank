// Rótulos legíveis dos tipos de regra do motor de validação — extraído aqui
// (fora de components/escritorio/lista-alertas.tsx) porque o export
// (lib/export/*, Route Handler) também precisa traduzir tipo_regra pra
// texto, e não faz sentido importar um Client Component só por causa de uma
// constante.
export const ROTULO_REGRA: Record<string, string> = {
  litros_acima_capacidade_tanque: "Litros acima da capacidade do tanque",
  nota_fiscal_duplicada: "Nota fiscal duplicada",
  foto_comprovante_duplicada: "Foto do comprovante duplicada",
  consumo_fora_da_faixa_historica: "Consumo fora da faixa histórica",
  consumo_fora_da_referencia_fabricante: "Consumo fora da referência de fábrica",
  litros_desproporcionais_ao_km_rodado: "Litros desproporcionais ao KM rodado",
  foto_antiga_ou_reaproveitada: "Foto do comprovante mais antiga que o esperado",
  divergencia_bomba_cupom_litros: "Litros da bomba divergem do cupom",
  divergencia_bomba_cupom_valor: "Valor da bomba diverge do cupom",
  km_hodometro_diverge_do_confirmado: "KM do hodômetro diverge do confirmado",
};
