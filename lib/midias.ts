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

export interface FotoBaixada {
  buffer: Buffer;
  // jsPDF só embute JPEG/PNG/WEBP nativamente (ver lib/export/pdf.ts) —
  // HEIC (comum em foto de iPhone) e outros tipos ficam de fora do
  // relatório em PDF (sem quebrar o resto: a linha só fica sem miniatura).
  formatoPdf: "JPEG" | "PNG" | "WEBP" | null;
}

function formatoPdfDoMime(mime: string): FotoBaixada["formatoPdf"] {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "JPEG";
  if (mime.includes("png")) return "PNG";
  if (mime.includes("webp")) return "WEBP";
  return null;
}

export async function baixarFotoComprovante(
  admin: ReturnType<typeof createAdminClient>,
  url: string
): Promise<FotoBaixada | null> {
  const caminho = extrairCaminhoDoBucket(url);
  if (!caminho) return null;

  const { data: arquivo, error } = await admin.storage.from("comprovantes").download(caminho);
  if (error || !arquivo) return null;

  return {
    buffer: Buffer.from(await arquivo.arrayBuffer()),
    formatoPdf: formatoPdfDoMime(arquivo.type || ""),
  };
}
