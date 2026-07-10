import { z } from "zod";

// Shape do que a IA extrai do comprovante. Todo campo é nullable — a IA nunca
// "inventa" um valor que não leu, isso é responsabilidade da validação.
export const dadosExtraidosSchema = z.object({
  data_abastecimento: z.string().nullable(),
  hora: z.string().nullable(),
  posto_nome: z.string().nullable(),
  posto_cidade: z.string().nullable(),
  posto_uf: z.string().nullable(),
  posto_cnpj: z.string().nullable(),
  litros: z.number().nullable(),
  valor_total: z.number().nullable(),
  valor_litro: z.number().nullable(),
  forma_pagamento: z.string().nullable(),
  numero_nota: z.string().nullable(),
  bandeira_posto: z.string().nullable(),
});

export type DadosExtraidos = z.infer<typeof dadosExtraidosSchema>;

// Visor da bomba (captura guiada de 3 fotos, Bloco 2, 2026-07-10) — mesma
// regra de "null em vez de chutar" do cupom.
export const dadosBombaSchema = z.object({
  litros: z.number().nullable(),
  valor_total: z.number().nullable(),
  valor_litro: z.number().nullable(),
});

export type DadosBomba = z.infer<typeof dadosBombaSchema>;

// Hodômetro (captura guiada de 3 fotos, Bloco 2, 2026-07-10) — só um campo:
// a leitura serve pra conferir contra o KM que o motorista digitar/confirmar
// (Bloco 3/4), nunca é gravada como o KM oficial sozinha.
export const dadosHodometroSchema = z.object({
  km: z.number().nullable(),
});

export type DadosHodometro = z.infer<typeof dadosHodometroSchema>;

export type OcrConfianca = "alta" | "media" | "baixa" | "falhou";

export interface OcrResultado<TDados = DadosExtraidos> {
  sucesso: boolean;
  confianca: OcrConfianca;
  dados: TDados | null;
  bruto: unknown;
  versaoPrompt: string;
}

// Interface independente de provedor — trocar de Gemini pra Claude/GPT no
// futuro é só implementar isto de novo, nada mais no app muda. Genérica em
// TDados pra poder ser reaproveitada por cupom (padrão, default do tipo),
// bomba e hodômetro sem duplicar a forma da interface.
export interface OcrProvider<TDados = DadosExtraidos> {
  extrair(imagem: { buffer: Buffer; mimeType: string }): Promise<OcrResultado<TDados>>;
}
