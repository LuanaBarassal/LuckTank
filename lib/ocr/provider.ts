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

export type OcrConfianca = "alta" | "media" | "baixa" | "falhou";

export interface OcrResultado {
  sucesso: boolean;
  confianca: OcrConfianca;
  dados: DadosExtraidos | null;
  bruto: unknown;
  versaoPrompt: string;
}

// Interface independente de provedor — trocar de Gemini pra Claude/GPT no
// futuro é só implementar isto de novo, nada mais no app muda.
export interface OcrProvider {
  extrair(imagem: { buffer: Buffer; mimeType: string }): Promise<OcrResultado>;
}
