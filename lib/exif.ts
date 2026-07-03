import "server-only";
import exifr from "exifr";

export interface DadosExifFoto {
  timestamp: string | null; // ISO 8601, do DateTimeOriginal — null = sem metadado
  gps: { lat: number; lon: number } | null;
}

const SEM_DADOS: DadosExifFoto = { timestamp: null, gps: null };

// Nunca lança — foto sem EXIF (print, WhatsApp, PNG, galeria que remove
// metadado) é o caso normal e esperado, não um erro. EXIF é uma camada de
// suspeita a mais (ver avaliarFotoAntigaOuReaproveitada em
// lib/validacao/regras.ts), nunca um portão: ausência de metadado nunca deve
// travar nem penalizar o motorista.
export async function extrairExifFoto(buffer: Buffer): Promise<DadosExifFoto> {
  try {
    const dados = await exifr.parse(buffer, {
      pick: ["DateTimeOriginal", "GPSLatitude", "GPSLongitude"],
    });
    if (!dados) return SEM_DADOS;

    const timestamp =
      dados.DateTimeOriginal instanceof Date && !Number.isNaN(dados.DateTimeOriginal.getTime())
        ? dados.DateTimeOriginal.toISOString()
        : null;

    const gps =
      typeof dados.GPSLatitude === "number" && typeof dados.GPSLongitude === "number"
        ? { lat: dados.GPSLatitude, lon: dados.GPSLongitude }
        : null;

    return { timestamp, gps };
  } catch {
    return SEM_DADOS;
  }
}
