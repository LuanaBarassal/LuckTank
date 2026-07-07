import "server-only";
import { SchemaType, type Schema } from "@google/generative-ai";
import { getGeminiFlashModel } from "@/lib/gemini/client";
import { dadosExtraidosSchema, type DadosExtraidos, type OcrConfianca, type OcrProvider, type OcrResultado } from "@/lib/ocr/provider";
import { PROMPT, VERSAO } from "@/lib/ocr/prompts/extrair-abastecimento.v2";

// Espelha dadosExtraidosSchema (lib/ocr/provider.ts) em forma de JSON Schema
// pro Gemini — `responseSchema` (junto de responseMimeType: "application/json")
// obriga o modelo a devolver os tipos certos (number continua number, nunca
// "12,50 L" como string), o que reduz bastante os casos de zod.safeParse
// falhando em foto nítida só porque o campo veio no tipo errado. `required`
// em todos os campos força o modelo a sempre emitir a chave (com null se não
// achou), batendo com o zod (que exige a chave presente, só o valor é
// nullable) — sem isso, uma chave ausente também quebrava o parse.
const CAMPOS_OBRIGATORIOS = [
  "data_abastecimento",
  "hora",
  "posto_nome",
  "posto_cidade",
  "posto_uf",
  "posto_cnpj",
  "litros",
  "valor_total",
  "valor_litro",
  "forma_pagamento",
  "numero_nota",
  "bandeira_posto",
] as const;

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    data_abastecimento: { type: SchemaType.STRING, nullable: true, description: "YYYY-MM-DD" },
    hora: { type: SchemaType.STRING, nullable: true, description: "HH:MM, 24h" },
    posto_nome: { type: SchemaType.STRING, nullable: true },
    posto_cidade: { type: SchemaType.STRING, nullable: true },
    posto_uf: { type: SchemaType.STRING, nullable: true, description: "sigla de 2 letras" },
    posto_cnpj: { type: SchemaType.STRING, nullable: true },
    litros: { type: SchemaType.NUMBER, nullable: true, description: "ponto decimal, nunca vírgula" },
    valor_total: { type: SchemaType.NUMBER, nullable: true, description: "ponto decimal, nunca vírgula" },
    valor_litro: { type: SchemaType.NUMBER, nullable: true, description: "ponto decimal, nunca vírgula" },
    forma_pagamento: { type: SchemaType.STRING, nullable: true },
    numero_nota: { type: SchemaType.STRING, nullable: true },
    bandeira_posto: { type: SchemaType.STRING, nullable: true },
  },
  required: [...CAMPOS_OBRIGATORIOS],
};

function extrairJson(texto: string): unknown {
  const limpo = texto.trim().replace(/^```json\s*|^```\s*|```$/g, "");
  return JSON.parse(limpo);
}

// Heurística de confiança: sem litros/valor_total o registro não serve pra
// nada (são obrigatórios no formulário de qualquer jeito), então isso conta
// mais que o resto dos campos.
function calcularConfianca(dados: DadosExtraidos): OcrConfianca {
  const essenciais = [dados.litros, dados.valor_total];
  const essenciaisPreenchidos = essenciais.filter((v) => v !== null).length;

  if (essenciaisPreenchidos === 0) return "falhou";

  const valores = Object.values(dados);
  const proporcaoPreenchida = valores.filter((v) => v !== null).length / valores.length;

  if (essenciaisPreenchidos === 2 && proporcaoPreenchida >= 0.6) return "alta";
  if (essenciaisPreenchidos === 2) return "media";
  return "baixa";
}

export const geminiOcrProvider: OcrProvider = {
  async extrair({ buffer, mimeType }): Promise<OcrResultado> {
    try {
      // Temperatura baixa: isto é extração determinística de dado que já
      // está na imagem, não geração criativa — sampling mais "quente" (o
      // default do modelo) só aumenta a chance de "chutar" um dígito em
      // texto ambíguo. `responseSchema` garante o tipo de cada campo.
      const model = getGeminiFlashModel({
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1,
      });

      const resposta = await model.generateContent([
        PROMPT,
        { inlineData: { data: buffer.toString("base64"), mimeType } },
      ]);

      const bruto = extrairJson(resposta.response.text());
      const parsed = dadosExtraidosSchema.safeParse(bruto);

      if (!parsed.success) {
        return { sucesso: false, confianca: "falhou", dados: null, bruto, versaoPrompt: VERSAO };
      }

      const confianca = calcularConfianca(parsed.data);
      return {
        sucesso: confianca !== "falhou",
        confianca,
        dados: parsed.data,
        bruto,
        versaoPrompt: VERSAO,
      };
    } catch (erro) {
      console.error("Falha no OCR do Gemini:", erro);
      return { sucesso: false, confianca: "falhou", dados: null, bruto: null, versaoPrompt: VERSAO };
    }
  },
};
