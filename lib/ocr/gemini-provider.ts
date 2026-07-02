import "server-only";
import { getGeminiFlashModel } from "@/lib/gemini/client";
import { dadosExtraidosSchema, type DadosExtraidos, type OcrConfianca, type OcrProvider, type OcrResultado } from "@/lib/ocr/provider";
import { PROMPT, VERSAO } from "@/lib/ocr/prompts/extrair-abastecimento.v1";

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
      const model = getGeminiFlashModel({ responseMimeType: "application/json" });

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
