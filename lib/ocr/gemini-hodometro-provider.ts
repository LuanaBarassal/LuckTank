import "server-only";
import { SchemaType, type Schema } from "@google/generative-ai";
import { executarExtracaoGemini } from "@/lib/ocr/motor-gemini";
import { dadosHodometroSchema, type DadosHodometro, type OcrConfianca, type OcrProvider } from "@/lib/ocr/provider";
import { PROMPT, VERSAO } from "@/lib/ocr/prompts/extrair-hodometro.v1";

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    km: { type: SchemaType.NUMBER, nullable: true, description: "quilometragem total, número inteiro" },
  },
  required: ["km"],
};

// Só um campo — ou leu com confiança (km presente) ou não deu pra ler
// (null). Diferente de cupom/bomba, não há "meio termo" possível aqui.
function calcularConfianca(dados: DadosHodometro): OcrConfianca {
  return dados.km !== null ? "alta" : "falhou";
}

export const geminiHodometroProvider: OcrProvider<DadosHodometro> = {
  async extrair({ buffer, mimeType }) {
    return executarExtracaoGemini({
      buffer,
      mimeType,
      prompt: PROMPT,
      responseSchema: RESPONSE_SCHEMA,
      versaoPrompt: VERSAO,
      schemaZod: dadosHodometroSchema,
      calcularConfianca,
      rotulo: "hodometro",
    });
  },
};
