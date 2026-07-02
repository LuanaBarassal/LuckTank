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

// Modelo com visão, usado no OCR do comprovante (Fase 4). Free tier: até ~1.500 leituras/dia.
// "gemini-flash-latest" é um alias mantido pelo Google que sempre aponta pro
// Flash atual — usar um nome de versão fixo (ex: "gemini-1.5-flash") quebra
// quando o modelo é descontinuado (já aconteceu uma vez neste projeto).
export function getGeminiFlashModel(generationConfig?: GenerationConfig) {
  return getGeminiClient().getGenerativeModel({ model: "gemini-flash-latest", generationConfig });
}
