import "server-only";
import QRCode from "qrcode";

export async function gerarQrPngBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

// SVG com o QR + uma legenda embaixo (placa do veículo) — pensado pra imprimir
// e colar no ônibus já com o identificador legível junto, sem precisar de uma
// lib de composição de imagem (canvas) só pra isso.
export async function gerarQrSvg(url: string, legenda?: string): Promise<string> {
  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
  });

  if (!legenda) return qrSvg;

  const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const tamanho = viewBoxMatch ? Number(viewBoxMatch[1]) : 33;
  const alturaLegenda = Math.round(tamanho * 0.16);
  const conteudoInterno = qrSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tamanho} ${tamanho + alturaLegenda}">` +
    `<rect width="${tamanho}" height="${tamanho + alturaLegenda}" fill="#ffffff" />` +
    conteudoInterno +
    `<text x="${tamanho / 2}" y="${tamanho + alturaLegenda / 2 + alturaLegenda * 0.12}" ` +
    `text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" ` +
    `font-size="${alturaLegenda * 0.6}">${escapeXml(legenda)}</text>` +
    `</svg>`
  );
}

function escapeXml(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
