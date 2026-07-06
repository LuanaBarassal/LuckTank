import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// A URL salva em `midias.url` é a pública antiga (getPublicUrl, gerada no
// upload em /api/abastecimentos) — continua no formato
// ".../object/public/comprovantes/<caminho>" mesmo com o bucket privado
// (desde a migration 0007 — getPublicUrl só monta a string, não valida se
// o bucket é público). Usado tanto por /api/midias/[id] (servir a foto pro
// escritório) quanto pelo export em PDF (embutir miniatura no relatório).
export function extrairCaminhoDoBucket(url: string): string | null {
  const marcador = "/object/public/comprovantes/";
  const indice = url.indexOf(marcador);
  if (indice === -1) return null;
  return decodeURIComponent(url.slice(indice + marcador.length));
}

// Detecção de formato compartilhada entre os dois consumidores abaixo — um
// só lugar de verdade pra "que tipo de imagem é este mime", cada consumidor
// decide o que fazer com o formato (jsPDF não sabe embutir HEIC; o zip de
// fotos não tem essa restrição nenhuma, é só armazenar o arquivo original).
type FormatoImagem = "jpeg" | "png" | "webp" | "heic" | null;

function formatoImagemDoMime(mime: string): FormatoImagem {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpeg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  return null;
}

export interface FotoBaixada {
  buffer: Buffer;
  // jsPDF só embute JPEG/PNG/WEBP nativamente (ver lib/export/pdf.ts) —
  // HEIC (comum em foto de iPhone) e outros tipos ficam de fora do
  // relatório em PDF (sem quebrar o resto: a linha só fica sem miniatura).
  formatoPdf: "JPEG" | "PNG" | "WEBP" | null;
}

export async function baixarFotoComprovante(
  admin: ReturnType<typeof createAdminClient>,
  url: string
): Promise<FotoBaixada | null> {
  const caminho = extrairCaminhoDoBucket(url);
  if (!caminho) return null;

  const { data: arquivo, error } = await admin.storage.from("comprovantes").download(caminho);
  if (error || !arquivo) return null;

  const formato = formatoImagemDoMime(arquivo.type || "");
  return {
    buffer: Buffer.from(await arquivo.arrayBuffer()),
    formatoPdf: formato === "jpeg" ? "JPEG" : formato === "png" ? "PNG" : formato === "webp" ? "WEBP" : null,
  };
}

export interface FotoBruta {
  buffer: Buffer;
  // Sempre uma extensão de verdade (nunca vazia) — "bin" é o fallback pra
  // mime não reconhecido, pra nunca gerar um nome de arquivo sem extensão
  // dentro do zip.
  extensao: string;
}

// Usado pelo export em ZIP (app/api/export/fotos/route.ts) — diferente de
// baixarFotoComprovante, aqui HEIC é um formato válido igual aos outros: o
// zip só guarda o arquivo original, não precisa saber renderizar nada.
export async function baixarFotoBruta(
  admin: ReturnType<typeof createAdminClient>,
  url: string
): Promise<FotoBruta | null> {
  const caminho = extrairCaminhoDoBucket(url);
  if (!caminho) return null;

  const { data: arquivo, error } = await admin.storage.from("comprovantes").download(caminho);
  if (error || !arquivo) return null;

  const formato = formatoImagemDoMime(arquivo.type || "");
  const extensao = formato === "jpeg" ? "jpg" : (formato ?? "bin");
  return {
    buffer: Buffer.from(await arquivo.arrayBuffer()),
    extensao,
  };
}
