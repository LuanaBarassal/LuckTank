import "server-only";
import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";

// Só pode ser importado dentro de app/api/** (Route Handlers). A chave nunca
// deve chegar a um Client Component — o "server-only" quebra o build se isso acontecer.
let client: GoogleGenerativeAI | null = null;

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith("placeholder")) {
    throw new Error("GEMINI_API_KEY não configurada (veja .env.example).");
  }
  return apiKey;
}

export function getGeminiClient(): GoogleGenerativeAI {
  if (!client) {
    client = new GoogleGenerativeAI(getApiKey());
  }
  return client;
}

// Modelo com visão, usado no OCR do comprovante (Fase 4).
//
// Decisão revista em 2026-07-10 (ver PROJETO.md): até aqui o projeto usava
// só "gemini-flash-latest" (alias mantido pelo Google, historicamente
// preferido a um nome fixo porque nome fixo quebra — 404 — quando
// descontinuado). Só que o alias já trocou de comportamento 2x este ano
// (Fase 4: 404 quando o modelo por trás foi descontinuado; 2026-07-08:
// passou a fazer "thinking" pesado sem aviso; 2026-07-10: confirmado
// apontando pro Gemini 3.5 Flash, um modelo "frontier" mais pesado, com
// respostas de até 79s e 503 "high demand" recorrente) — o alias deixou de
// ser a opção estável.
//
// Testado direto contra a API (2026-07-10): na MESMA foto real de
// comprovante, "gemini-2.5-flash" (nome estável, não é snapshot datado tipo
// "-001" — esses têm cota ZERO no free tier deste projeto, confirmado via
// 429 "limit: 0") extraiu todos os campos essenciais corretos (litros,
// valor_total, valor_litro) em ~9s; "gemini-flash-latest" falhou 5 de 5
// vezes na mesma sessão (503 ou lentidão extrema). Modelo fixo agora é o
// principal; o alias volta como FALLBACK só se o principal um dia for
// descontinuado de verdade (404) — ver `chamarGeminiComFallbackDeModelo` em
// lib/ocr/gemini-provider.ts.
export const MODELO_FLASH_PRINCIPAL = "gemini-2.5-flash";
export const MODELO_FLASH_FALLBACK = "gemini-flash-latest";

export function getGeminiFlashModel(generationConfig?: GenerationConfig, modelo: string = MODELO_FLASH_PRINCIPAL) {
  return getGeminiClient().getGenerativeModel({ model: modelo, generationConfig });
}
