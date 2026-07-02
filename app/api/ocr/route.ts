import { NextRequest, NextResponse } from "next/server";
import { geminiOcrProvider } from "@/lib/ocr/gemini-provider";

// Só extrai e devolve os dados — não grava nada no banco. A gravação
// definitiva acontece em /api/abastecimentos, depois que o motorista
// confere/edita o que veio daqui.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const foto = formData.get("foto");

  if (!(foto instanceof File) || foto.size === 0) {
    return NextResponse.json({ error: "Foto obrigatória." }, { status: 400 });
  }

  const buffer = Buffer.from(await foto.arrayBuffer());
  const resultado = await geminiOcrProvider.extrair({
    buffer,
    mimeType: foto.type || "image/jpeg",
  });

  return NextResponse.json(resultado);
}
