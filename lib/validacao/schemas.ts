import { z } from "zod";

export const TIPOS_COMBUSTIVEL = [
  "diesel_s10",
  "diesel_s500",
  "arla",
  "gasolina",
  "etanol",
] as const;

export const ROTULO_TIPO_COMBUSTIVEL: Record<(typeof TIPOS_COMBUSTIVEL)[number], string> = {
  diesel_s10: "Diesel S10",
  diesel_s500: "Diesel S500",
  arla: "Arla",
  gasolina: "Gasolina",
  etanol: "Etanol",
};

const textoOpcional = z
  .string()
  .trim()
  .max(120)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const veiculoSchema = z.object({
  placa: z
    .string()
    .trim()
    .min(5, "Placa muito curta")
    .max(10)
    .transform((v) => v.toUpperCase()),
  // Identificador operacional (ex.: "1450") — opcional de propósito:
  // veículos cadastrados antes deste campo existir não têm prefixo, e
  // preencher não deveria ser bloqueante pro cadastro seguir funcionando.
  prefixo: z.string().trim().max(20).optional().or(z.literal("")).transform((v) => (v ? v : null)),
  modelo: textoOpcional,
  marca: textoOpcional,
  ano: z.coerce
    .number()
    .int()
    .min(1970)
    .max(new Date().getFullYear() + 1)
    .optional()
    .nullable(),
  capacidade_tanque_litros: z.coerce.number().positive().max(2000).optional().nullable(),
  tipo_combustivel: z.enum(TIPOS_COMBUSTIVEL).optional().nullable(),
  foto_url: z.string().url().optional().nullable(),
  // Consumo esperado (manual/ficha técnica do fabricante), em km/L — usado
  // só como referência no comparativo da aba do veículo (lib/onibus/estatisticas.ts),
  // nunca no motor de fraude. Teto de 50 km/L cobre qualquer veículo
  // (não só ônibus a diesel), sem abrir espaço pra valor absurdo digitado errado.
  consumo_referencia_kml: z.coerce.number().positive().max(50).optional().nullable(),
});

// Mesmos campos editáveis do cadastro — qr_token propositalmente NUNCA aparece aqui,
// então não tem como um payload de edição sobrescrevê-lo.
export const veiculoEdicaoSchema = veiculoSchema;

export const motoristaSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(120),
  cpf: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "CPF deve ter 11 dígitos")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

// Cria uma empresa (tenant) nova + convida o primeiro administrador dela —
// só usado pelo painel de administração do sistema (app/(escritorio)/admin-sistema),
// nunca pelo fluxo normal de uma empresa já existente.
export const criarEmpresaSchema = z.object({
  nomeEmpresa: z.string().trim().min(2, "Nome muito curto").max(120),
  nomeAdministrador: z.string().trim().min(2, "Nome muito curto").max(120),
  emailAdministrador: z.string().trim().email("E-mail inválido"),
});

// Caixa do escritório que recebe o e-mail de "abastecimento registrado"
// (lib/email/notificar-abastecimento.ts) — nullable no schema porque `null`
// explícito é como se limpa o campo (mesmo padrão de atualizarProximaRenovacao).
export const emailNotificacaoSchema = z
  .string()
  .trim()
  .email("E-mail inválido")
  .nullable();

export const PAPEIS = ["supervisor", "gerente", "administrador"] as const;

export const convidarUsuarioSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().email("E-mail inválido"),
  papel: z.enum(PAPEIS),
});

export const FORMAS_PAGAMENTO = [
  "cartao_frota",
  "cartao_credito",
  "cartao_debito",
  "dinheiro",
  "pix",
  "boleto",
] as const;

export const ROTULO_FORMA_PAGAMENTO: Record<(typeof FORMAS_PAGAMENTO)[number], string> = {
  cartao_frota: "Cartão frota",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  dinheiro: "Dinheiro",
  pix: "Pix",
  boleto: "Boleto",
};

// Entrada manual do motorista (Fase 3, sem OCR). Os nomes de campo aqui
// batem 1:1 com as colunas de `abastecimentos` — o Route Handler só valida,
// não traduz nomes.
export const abastecimentoSchema = z
  .object({
    motorista_id: z.string().uuid().optional().nullable(),
    motorista_nome_livre: z.string().trim().min(2).max(120).optional().nullable(),
    data_abastecimento: z.string().min(1, "Informe a data"),
    hora: z.string().trim().optional().nullable(),
    posto_nome: textoOpcional,
    posto_cidade: textoOpcional,
    posto_cnpj: textoOpcional,
    posto_uf: z
      .string()
      .trim()
      .length(2, "UF deve ter 2 letras")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v.toUpperCase() : null)),
    litros: z.coerce.number().positive("Litros deve ser maior que zero").max(2000),
    valor_total: z.coerce.number().positive("Valor deve ser maior que zero").max(100000),
    // Confirmado/editado pelo motorista — sem regra de consistência com
    // litros×valor_total (mesmo corte de escopo da 0001_init.sql). Opcional:
    // fluxo sem OCR (offline/manual) pode seguir sem preencher.
    valor_litro: z.coerce.number().positive("Valor por litro inválido").max(50).optional().nullable(),
    forma_pagamento: z.enum(FORMAS_PAGAMENTO).optional().nullable(),
    numero_nota: textoOpcional,
    bandeira_posto: textoOpcional,
    km_atual: z.coerce.number().positive("KM inválido"),
    registro_uuid: z.string().uuid(),
    // Fase 5: informa se veio direto do fluxo online ou da fila offline
    // sincronizada depois — só metadado de auditoria, default "online".
    origem_registro: z.enum(["online", "fila_offline"]).optional(),
    // Metadados de OCR (Fase 4) — sempre opcionais, o fluxo sem IA (Fase 3)
    // continua funcionando sem eles. Vêm como JSON serializado em texto
    // (FormData só carrega strings); o Route Handler faz o parse.
    ocr_confianca: z.enum(["alta", "media", "baixa", "falhou"]).optional().nullable(),
    ocr_prompt_version: textoOpcional,
    ocr_raw: z.string().optional().nullable(),
    campos_editados_manualmente: z.string().optional().nullable(),
    // Leituras da IA na foto da bomba/hodômetro (captura guiada de 3 fotos,
    // Bloco 4) — sempre opcionais: bomba/hodômetro são fotos opcionais desde
    // o Bloco 1, e mesmo quando tiradas a leitura pode falhar. Guardadas
    // separado do que foi confirmado (litros/valor_total/km_atual acima) pra
    // alimentar as regras de conferência cruzada em lib/validacao/regras.ts.
    bomba_litros_lido: z.coerce.number().positive().max(2000).optional().nullable(),
    bomba_valor_total_lido: z.coerce.number().positive().max(100000).optional().nullable(),
    hodometro_km_lido: z.coerce.number().positive().optional().nullable(),
  })
  .refine((data) => data.motorista_id || data.motorista_nome_livre, {
    message: "Selecione ou informe o nome do motorista",
    path: ["motorista_nome_livre"],
  });
