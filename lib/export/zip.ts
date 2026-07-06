import "server-only";
import JSZip from "jszip";

// Empacota as fotos já baixadas (buffers em memória) num único .zip —
// mesmo espírito de excel.ts/pdf.ts: recebe dado já resolvido, não sabe
// nada de Storage/Supabase. `jszip` (não `archiver`) de propósito: já é
// dependência transitiva do exceljs, é puro JS sem binding nativo (mesmo
// motivo de jspdf-vs-pdfkit em pdf.ts — sem risco de arquivo de sistema
// não rastreado no bundling da function serverless da Vercel).
export async function gerarZipFotos(arquivos: { nome: string; buffer: Buffer }[]): Promise<Buffer> {
  const zip = new JSZip();
  for (const arquivo of arquivos) {
    zip.file(arquivo.nome, arquivo.buffer);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
