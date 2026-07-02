import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarQrPngBuffer, gerarQrSvg } from "@/lib/qr";

// Autenticado (o middleware já barra sem sessão); a query em si é RLS-scoped
// pela sessão do usuário — se o veículo não for da empresa dele, vem vazio.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: veiculo, error } = await supabase
    .from("veiculos")
    .select("id, placa, qr_token")
    .eq("id", params.id)
    .single();

  if (error || !veiculo) {
    return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });
  }

  const url = `${request.nextUrl.origin}/r/${veiculo.qr_token}`;
  const formato = request.nextUrl.searchParams.get("formato") === "png" ? "png" : "svg";
  const baixar = request.nextUrl.searchParams.get("baixar") === "1";
  const arquivo = `qr-${veiculo.placa}`;
  const disposicao = baixar ? "attachment" : "inline";

  if (formato === "png") {
    const buffer = await gerarQrPngBuffer(url);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `${disposicao}; filename="${arquivo}.png"`,
      },
    });
  }

  const svg = await gerarQrSvg(url, veiculo.placa);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `${disposicao}; filename="${arquivo}.svg"`,
    },
  });
}
