// Validação de foto de comprovante — usada tanto em /api/ocr quanto em
// /api/abastecimentos. Nunca confia no `accept="image/*"` do client (é só
// dica de UI, qualquer um pode subir outra coisa direto via fetch) nem no
// `file.type` declarado pelo client (também é auto-declarado) — checa os
// bytes de assinatura reais do arquivo.

export const TAMANHO_MAXIMO_FOTO_BYTES = 8 * 1024 * 1024; // 8MB

function comecaCom(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((b, i) => buffer[i] === b);
}

function ehWebp(buffer: Buffer): boolean {
  // RIFF....WEBP: "RIFF" nos 4 primeiros bytes, "WEBP" a partir do byte 8.
  return (
    comecaCom(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer.length >= 12 &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function ehHeic(buffer: Buffer): boolean {
  // Box ftyp do formato ISO BMFF (HEIC/HEIF, padrão da câmera do iPhone):
  // bytes 4-7 = "ftyp", marca em 8-11 indica o tipo.
  if (buffer.length < 12) return false;
  if (buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  const marca = buffer.subarray(8, 12).toString("ascii");
  return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(marca);
}

function assinaturaDeImagemValida(buffer: Buffer): boolean {
  return (
    comecaCom(buffer, [0xff, 0xd8, 0xff]) || // JPEG
    comecaCom(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) || // PNG
    ehWebp(buffer) ||
    ehHeic(buffer)
  );
}

export interface ResultadoValidacaoFoto {
  valido: boolean;
  erro?: string;
}

export function validarFoto(file: File, buffer: Buffer): ResultadoValidacaoFoto {
  if (file.size === 0) {
    return { valido: false, erro: "Foto vazia." };
  }

  if (file.size > TAMANHO_MAXIMO_FOTO_BYTES) {
    return { valido: false, erro: "Foto muito grande (máximo 8MB)." };
  }

  if (!assinaturaDeImagemValida(buffer)) {
    return { valido: false, erro: "Arquivo não é uma imagem válida." };
  }

  return { valido: true };
}

// Lista fechada, nunca o valor cru: `mimeType` é auto-declarado pelo
// client (assim como `foto.name`), mas aqui só decide uma extensão dentro
// de um conjunto pequeno e conhecido — não pode carregar nada arbitrário
// pra dentro da key do Storage. Compartilhado entre todo upload de foto do
// projeto (comprovante de abastecimento e foto de veículo) — um só lugar
// de verdade pra "que extensão esse mime vira".
export function extensaoSeguraFoto(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("heic") || mimeType.includes("heif")) return "heic";
  return "bin";
}

// Nota fiscal anexada pelo escritório (Bloco 2 da NF): além de foto, aceita
// PDF — a DANFE costuma chegar por e-mail como PDF, não como foto. Mesma
// filosofia do resto do arquivo: decide pelos bytes de assinatura reais,
// nunca pelo `file.type`/nome declarados. Teto do PDF menor que o da foto
// porque o PDF não passa pela compressão do navegador e o corpo de uma
// Server Action/function na Vercel não passa de ~4,5MB.
export const TAMANHO_MAXIMO_PDF_NOTA_BYTES = 4 * 1024 * 1024;

export type ResultadoValidacaoNotaFiscal =
  | { valido: true; extensao: string; contentType: string }
  | { valido: false; erro: string };

export function validarArquivoNotaFiscal(file: File, buffer: Buffer): ResultadoValidacaoNotaFiscal {
  if (comecaCom(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    // "%PDF-"
    if (file.size > TAMANHO_MAXIMO_PDF_NOTA_BYTES) {
      return { valido: false, erro: "PDF muito grande (máximo 4MB)." };
    }
    return { valido: true, extensao: "pdf", contentType: "application/pdf" };
  }

  if (file.size > 0 && !assinaturaDeImagemValida(buffer)) {
    return { valido: false, erro: "Envie uma foto ou um PDF da nota." };
  }
  const foto = validarFoto(file, buffer);
  if (!foto.valido) return { valido: false, erro: foto.erro ?? "Arquivo inválido." };
  return { valido: true, extensao: extensaoSeguraFoto(file.type), contentType: file.type || "image/jpeg" };
}
