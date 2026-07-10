import "server-only";
import { SchemaType, type Schema } from "@google/generative-ai";
import { executarExtracaoGemini } from "@/lib/ocr/motor-gemini";
import { dadosBombaSchema, type DadosBomba, type OcrConfianca, type OcrProvider } from "@/lib/ocr/provider";
import { PROMPT, VERSAO } from "@/lib/ocr/prompts/extrair-bomba.v1";

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    litros: { type: SchemaType.NUMBER, nullable: true, description: "ponto decimal, nunca vírgula" },
    valor_total: { type: SchemaType.NUMBER, nullable: true, description: "ponto decimal, nunca vírgula" },
    valor_litro: { type: SchemaType.NUMBER, nullable: true, description: "ponto decimal, nunca vírgula" },
  },
  required: ["litros", "valor_total", "valor_litro"],
};

// Mesma heurística do cupom (lib/ocr/gemini-provider.ts): litros/valor_total
// são os campos essenciais pra conferência cruzada (Bloco 4), valor_litro é
// bônus.
function calcularConfianca(dados: DadosBomba): OcrConfianca {
  const essenciais = [dados.litros, dados.valor_total];
  const essenciaisPreenchidos = essenciais.filter((v) => v !== null).length;

  if (essenciaisPreenchidos === 0) return "falhou";
  if (essenciaisPreenchidos === 2 && dados.valor_litro !== null) return "alta";
  if (essenciaisPreenchidos === 2) return "media";
  return "baixa";
}

export const geminiBombaProvider: OcrProvider<DadosBomba> = {
  async extrair({ buffer, mimeType }) {
    return executarExtracaoGemini({
      buffer,
      mimeType,
      prompt: PROMPT,
      responseSchema: RESPONSE_SCHEMA,
      versaoPrompt: VERSAO,
      schemaZod: dadosBombaSchema,
      calcularConfianca,
      rotulo: "bomba",
    });
  },
};
