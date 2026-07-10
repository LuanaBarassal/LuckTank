import { NextRequest, NextResponse } from "next/server";
import { geminiOcrProvider } from "@/lib/ocr/gemini-provider";
import { geminiBombaProvider } from "@/lib/ocr/gemini-bomba-provider";
import { geminiHodometroProvider } from "@/lib/ocr/gemini-hodometro-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarFoto } from "@/lib/validacao/arquivo";
import { limitarOcr, obterIp } from "@/lib/rate-limit";

// Captura guiada de 3 fotos (Bloco 2, 2026-07-10): mesma rota atende os 3
// tipos de leitura — "tipo" ausente ou desconhecido cai em "cupom" (mantém o
// comportamento de sempre pro client existente, que nunca manda esse campo).
// Cada provider já encapsula seu próprio prompt/schema/heurística de
// confiança, mas reaproveita o MESMO motor de chamada (timeout, retry,
// fallback de modelo) — ver lib/ocr/motor-gemini.ts.
function providerPorTipo(tipo: string | null) {
  if (tipo === "bomba") return geminiBombaProvider;
  if (tipo === "hodometro") return geminiHodometroProvider;
  return geminiOcrProvider;
}

// Plano Hobby da Vercel: teto rígido de 60s por function. Pior caso do OCR
// (achado 2026-07-10): 1 tentativa (até 20s de timeout) + backoff (até 4s) +
// 2ª tentativa só em caso de 503/429 (até mais 20s) ~= 44s no pior caso —
// 55s dá folga suficiente pro resto do handler (parse de FormData, validação
// de arquivo, resposta) sem chegar perto do teto do plano.
export const maxDuration = 55;

// Só extrai e devolve os dados — não grava nada no banco. A gravação
// definitiva acontece em /api/abastecimentos, depois que o motorista
// confere/edita o que veio daqui.
//
// Exige qr_token válido (mesmo que /api/abastecimentos): sem isso, a rota
// ficava aberta pra qualquer chamada anônima consumir a cota gratuita do
// Gemini (~1.500 leituras/dia) sem nem precisar de um veículo real.
export async function POST(request: NextRequest) {
  const { permitido } = await limitarOcr(obterIp(request));
  if (!permitido) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um minuto e tente novamente." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    // Content-Type ausente/errado (não multipart) — requisição malformada,
    // não uma exceção do servidor. Sem isso, request.formData() lança e vira
    // um 500 pra qualquer POST vazio ou mal formado.
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const qrToken = formData.get("qr_token");
  if (typeof qrToken !== "string" || !qrToken) {
    return NextResponse.json({ error: "QR inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: veiculo } = await admin
    .from("veiculos")
    .select("id")
    .eq("qr_token", qrToken)
    .eq("ativo", true)
    .single();

  if (!veiculo) {
    return NextResponse.json({ error: "Veículo não encontrado." }, { status: 404 });
  }

  const foto = formData.get("foto");
  if (!(foto instanceof File)) {
    return NextResponse.json({ error: "Foto obrigatória." }, { status: 400 });
  }

  const buffer = Buffer.from(await foto.arrayBuffer());
  const validacao = validarFoto(foto, buffer);
  if (!validacao.valido) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  const tipo = formData.get("tipo");
  const provider = providerPorTipo(typeof tipo === "string" ? tipo : null);

  const resultado = await provider.extrair({
    buffer,
    mimeType: foto.type || "image/jpeg",
  });

  return NextResponse.json(resultado);
}
