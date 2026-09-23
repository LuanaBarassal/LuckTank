import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { gerarEtiquetaPdf } from "@/lib/etiqueta/pdf";
import { formatarVeiculo } from "@/lib/formatacao";
import { normalizarSlug } from "@/lib/export/nome-arquivo";

// Etiqueta do QR em PDF (A4, 1 página) — ver lib/etiqueta/pdf.ts pra o porquê
// de gerar PDF em vez de depender do "imprimir página" do navegador.
// Sessão do usuário (RLS): veículo e dados da NF só da empresa de quem pede —
// veículo de outra empresa volta vazio, igual a "não existe" (mesmo padrão
// de /api/veiculos/[id]/qr). A URL do QR é EXATAMENTE a mesma da rota do QR
// e da página de impressão: `${origin}/r/${qr_token}` (qr_token é permanente,
// invariante #3).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const supabase = await createClient();
  const [{ data: veiculo }, { data: empresa }] = await Promise.all([
    supabase.from("veiculos").select("placa, prefixo, modelo, ano, qr_token").eq("id", params.id).single(),
    supabase
      .from("empresas")
      .select("nota_fiscal_cnpj, nota_fiscal_whatsapp, nota_fiscal_email")
      .eq("id", usuario.empresa_id)
      .single(),
  ]);

  if (!veiculo) return NextResponse.json({ error: "Veículo não encontrado." }, { status: 404 });

  // Mesma URL da rota do QR e da página de impressão — o QR em si é
  // desenhado em vetor dentro do PDF (lib/etiqueta/pdf.ts).
  const qrUrl = `${request.nextUrl.origin}/r/${veiculo.qr_token}`;

  const pdf = gerarEtiquetaPdf({
    veiculoLabel: formatarVeiculo(veiculo.prefixo, veiculo.placa),
    modeloAno: [veiculo.modelo, veiculo.ano].filter(Boolean).join(" · ") || null,
    qrUrl,
    notaFiscal: empresa
      ? { cnpj: empresa.nota_fiscal_cnpj, whatsapp: empresa.nota_fiscal_whatsapp, email: empresa.nota_fiscal_email }
      : null,
  });

  // Nome de lista fechada (slug), nunca texto cru no header.
  const nome = ["etiqueta", veiculo.prefixo ?? "", veiculo.placa].map(normalizarSlug).filter(Boolean).join("_");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nome}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
