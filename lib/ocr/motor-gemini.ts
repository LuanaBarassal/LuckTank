import "server-only";
import type { Schema } from "@google/generative-ai";
import { GoogleGenerativeAIFetchError } from "@google/generative-ai";
import type { z } from "zod";
import { getGeminiFlashModel, MODELO_FLASH_PRINCIPAL, MODELO_FLASH_FALLBACK } from "@/lib/gemini/client";
import type { OcrConfianca, OcrResultado } from "@/lib/ocr/provider";

// Motor genérico de extração via Gemini — reaproveitado por cupom, bomba e
// hodômetro (captura guiada de 3 fotos, Bloco 2, 2026-07-10). Só o prompt, o
// responseSchema (JSON Schema do Gemini), o schema Zod e a heurística de
// confiança mudam por tipo de foto; timeout, retry, fallback de modelo e
// logging de diagnóstico são os MESMOS pros 3 — extraídos daqui pra não
// duplicar essa lógica a cada novo tipo de leitura.

// Achado 2026-07-10 (investigando "OCR falha/trava com frequência em
// produção"): uma chamada real ao Gemini por trás do alias
// "gemini-flash-latest" levou 79s pra responder, e outra devolveu 503
// ("high demand") só depois de 70s de espera — a Vercel (plano Hobby, teto
// de 60s por function) provavelmente mata a function no meio dessas
// chamadas antes que qualquer retry interno tivesse chance de rodar. Duas
// mudanças em resposta:
// 1. Timeout de requisição por tentativa (abaixo) — falha rápido e
//    controlado em vez de deixar a plataforma matar a function sem aviso.
// 2. Retry deixou de ser "tenta de novo sempre até 2x" — agora só tenta de
//    novo quando o Gemini responde com 503/429 DENTRO do timeout (sinal de
//    sobrecarga real e transitória, vale a pena esperar um pouco e tentar
//    de novo). Erro de parse/schema ou timeout/abort não ganham retry
//    aqui — não adianta repetir o mesmo jeito, e cada tentativa custa caro
//    de tempo dentro do orçamento apertado da function. A segunda chance
//    nesses casos já existe numa camada acima (client pede foto nova, até
//    2x, ver `MAXIMO_TENTATIVAS_OCR` em fluxo-abastecimento.tsx).
const TIMEOUT_MS_POR_TENTATIVA = 20_000;
const BACKOFF_MS_PADRAO_503 = 1_500;
const BACKOFF_MS_MAXIMO = 4_000; // nunca esperar mais que isso — orçamento de time da function é apertado

// DIAGNÓSTICO TEMPORÁRIO (2026-07-10, investigando "OCR falha com frequência
// em produção") — logging estruturado do que acontece em cada tentativa real
// ao Gemini: tempo de resposta, tamanho da imagem, status HTTP/erro quando
// falha. Nunca loga o buffer da foto nem a API key. Remover (ou reduzir pra
// só o essencial) depois que o diagnóstico for concluído e a correção
// aplicada — não é para ficar em produção pra sempre neste nível de detalhe.
function logDiagnosticoOcr(evento: Record<string, unknown>) {
  console.log("[ocr-diagnostico]", JSON.stringify({ timestamp: new Date().toISOString(), ...evento }));
}

// Alguns erros 503/429 do Gemini vêm com um `details` no formato gRPC
// (`RetryInfo`, `retryDelay: "5s"`) — quando presente, é a estimativa do
// próprio Google de quanto esperar; usamos isso em vez do backoff fixo,
// sempre limitado a BACKOFF_MS_MAXIMO pra não estourar o orçamento de tempo
// da function.
function calcularBackoffMs(errorDetails: unknown): number {
  if (Array.isArray(errorDetails)) {
    for (const detalhe of errorDetails) {
      const retryDelay = (detalhe as { retryDelay?: unknown } | null)?.retryDelay;
      if (typeof retryDelay === "string") {
        const match = retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
        if (match) return Math.min(Number(match[1]) * 1000, BACKOFF_MS_MAXIMO);
      }
    }
  }
  return BACKOFF_MS_PADRAO_503;
}

function ehErroTransitorioRetentavel(erro: unknown): erro is GoogleGenerativeAIFetchError {
  return erro instanceof GoogleGenerativeAIFetchError && (erro.status === 503 || erro.status === 429);
}

function extrairJson(texto: string): unknown {
  const limpo = texto.trim().replace(/^```json\s*|^```\s*|```$/g, "");
  return JSON.parse(limpo);
}

export interface ParametrosExtracaoGemini<TDados> {
  buffer: Buffer;
  mimeType: string;
  prompt: string;
  responseSchema: Schema;
  versaoPrompt: string;
  schemaZod: z.ZodType<TDados>;
  calcularConfianca: (dados: TDados) => OcrConfianca;
  // Só pro log de diagnóstico (ex.: "cupom" | "bomba" | "hodometro") —
  // ajuda a distinguir os 3 tipos de leitura nos logs da Vercel.
  rotulo: string;
}

// Faz UMA chamada real ao Gemini. Sucesso ou falha de parse/schema viram
// OcrResultado normalmente; qualquer exceção (timeout, 503, 429, erro de
// rede) é logada aqui mas RELANÇADA (não vira "falhou" direto) — quem decide
// se vale a pena tentar de novo é `executarExtracaoGemini`, não esta função.
async function chamarGeminiUmaVez<TDados>(
  params: ParametrosExtracaoGemini<TDados>,
  tentativa: number,
  modelo: string
): Promise<OcrResultado<TDados>> {
  const { buffer, mimeType, prompt, responseSchema, versaoPrompt, schemaZod, calcularConfianca, rotulo } = params;
  const inicio = Date.now();
  try {
    // Temperatura baixa: isto é extração determinística de dado que já
    // está na imagem, não geração criativa — sampling mais "quente" (o
    // default do modelo) só aumenta a chance de "chutar" um dígito em
    // texto ambíguo. `responseSchema` garante o tipo de cada campo.
    const model = getGeminiFlashModel(
      { responseMimeType: "application/json", responseSchema, temperature: 0.1 },
      modelo
    );

    const resposta = await model.generateContent(
      [prompt, { inlineData: { data: buffer.toString("base64"), mimeType } }],
      { timeout: TIMEOUT_MS_POR_TENTATIVA }
    );

    const elapsedMs = Date.now() - inicio;
    const bruto = extrairJson(resposta.response.text());
    const parsed = schemaZod.safeParse(bruto);

    logDiagnosticoOcr({
      rotulo,
      tentativa,
      modelo,
      resultado: parsed.success ? "sucesso" : "parse_zod_falhou",
      elapsedMs,
      imagemBytes: buffer.length,
      mimeType,
      // SDK não tipa thoughtsTokenCount ainda, mas a API real devolve o campo
      // (confirmado em teste direto contra a API) — cast local só pro log.
      thoughtsTokenCount: (resposta.response.usageMetadata as { thoughtsTokenCount?: number } | undefined)
        ?.thoughtsTokenCount,
      totalTokenCount: resposta.response.usageMetadata?.totalTokenCount,
      zodErro: parsed.success ? undefined : parsed.error.issues,
    });

    if (!parsed.success) {
      return { sucesso: false, confianca: "falhou", dados: null, bruto, versaoPrompt };
    }

    const confianca = calcularConfianca(parsed.data);
    return {
      sucesso: confianca !== "falhou",
      confianca,
      dados: parsed.data,
      bruto,
      versaoPrompt,
    };
  } catch (erro) {
    const elapsedMs = Date.now() - inicio;
    const ehErroFetch = erro instanceof GoogleGenerativeAIFetchError;
    logDiagnosticoOcr({
      rotulo,
      tentativa,
      modelo,
      resultado: "excecao",
      elapsedMs,
      imagemBytes: buffer.length,
      mimeType,
      erroNome: erro instanceof Error ? erro.name : typeof erro,
      erroMensagem: erro instanceof Error ? erro.message : String(erro),
      httpStatus: ehErroFetch ? erro.status : undefined,
      httpStatusText: ehErroFetch ? erro.statusText : undefined,
      httpErrorDetails: ehErroFetch ? erro.errorDetails : undefined,
    });
    console.error(`Falha no OCR do Gemini (${rotulo}):`, erro);
    throw erro;
  }
}

// Só entra em jogo se MODELO_FLASH_PRINCIPAL for descontinuado de verdade
// (404) — troca pro alias "-latest" como rede de segurança, exatamente o
// cenário que motivou usar o alias como principal até 2026-07-10. Não
// conta como uma das tentativas de retry por sobrecarga (503/429): é uma
// falha de configuração, não transitória.
async function chamarComFallbackDeModelo<TDados>(
  params: ParametrosExtracaoGemini<TDados>,
  tentativa: number
): Promise<OcrResultado<TDados>> {
  try {
    return await chamarGeminiUmaVez(params, tentativa, MODELO_FLASH_PRINCIPAL);
  } catch (erro) {
    if (erro instanceof GoogleGenerativeAIFetchError && erro.status === 404) {
      logDiagnosticoOcr({
        rotulo: params.rotulo,
        evento: "fallback_modelo_descontinuado",
        modeloPrincipal: MODELO_FLASH_PRINCIPAL,
        modeloFallback: MODELO_FLASH_FALLBACK,
      });
      return await chamarGeminiUmaVez(params, tentativa, MODELO_FLASH_FALLBACK);
    }
    throw erro;
  }
}

// Orquestra a extração completa (até 2 chamadas reais no pior caso, só
// quando a 1ª bate num 503/429 respondido dentro do timeout) pra QUALQUER
// tipo de foto — cupom, bomba ou hodômetro, cada um passando seu próprio
// prompt/schema/heurística de confiança via `params`.
export async function executarExtracaoGemini<TDados>(
  params: ParametrosExtracaoGemini<TDados>
): Promise<OcrResultado<TDados>> {
  const inicioTotal = Date.now();
  const FALHOU: OcrResultado<TDados> = {
    sucesso: false,
    confianca: "falhou",
    dados: null,
    bruto: null,
    versaoPrompt: params.versaoPrompt,
  };

  try {
    const resultado = await chamarComFallbackDeModelo(params, 1);
    logDiagnosticoOcr({
      rotulo: params.rotulo,
      evento: "extrair_concluido",
      sucesso: resultado.sucesso,
      tentativasUsadas: 1,
      elapsedTotalMs: Date.now() - inicioTotal,
    });
    return resultado;
  } catch (erro) {
    if (!ehErroTransitorioRetentavel(erro)) {
      // Timeout/abort, erro de rede, ou qualquer status HTTP que não seja
      // 503/429: repetir do mesmo jeito não ajuda, e já consumimos parte
      // do orçamento de tempo da function — falha rápido.
      logDiagnosticoOcr({
        rotulo: params.rotulo,
        evento: "extrair_concluido",
        sucesso: false,
        tentativasUsadas: 1,
        elapsedTotalMs: Date.now() - inicioTotal,
        motivo: "erro_nao_retentavel",
      });
      return FALHOU;
    }

    const backoffMs = calcularBackoffMs(erro.errorDetails);
    logDiagnosticoOcr({ rotulo: params.rotulo, evento: "retry_sobrecarga_transitoria", httpStatus: erro.status, backoffMs });
    await new Promise((resolve) => setTimeout(resolve, backoffMs));

    try {
      const resultado = await chamarComFallbackDeModelo(params, 2);
      logDiagnosticoOcr({
        rotulo: params.rotulo,
        evento: "extrair_concluido",
        sucesso: resultado.sucesso,
        tentativasUsadas: 2,
        elapsedTotalMs: Date.now() - inicioTotal,
      });
      return resultado;
    } catch {
      logDiagnosticoOcr({
        rotulo: params.rotulo,
        evento: "extrair_concluido",
        sucesso: false,
        tentativasUsadas: 2,
        elapsedTotalMs: Date.now() - inicioTotal,
        motivo: "segunda_tentativa_tambem_falhou",
      });
      return FALHOU;
    }
  }
}
