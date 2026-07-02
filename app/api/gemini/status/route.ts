import { NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini/client";

// Só confirma que a chave está configurada e o SDK instancia — não faz chamada
// de rede nenhuma (evita gastar quota do free tier só pra checar status).
export async function GET() {
  try {
    getGeminiClient();
    return NextResponse.json({ configurado: true });
  } catch {
    return NextResponse.json({ configurado: false });
  }
}
