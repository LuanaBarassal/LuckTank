// Só usado no caminho offline — reduz o tamanho antes de guardar no
// IndexedDB (que tem cota limitada e no fluxo online a foto já vai direto
// pro servidor sem passar por aqui).
export async function comprimirImagem(
  file: File,
  maxDimensao = 1280,
  qualidade = 0.75
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxDimensao / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", qualidade)
    );

    return blob ?? file;
  } catch {
    // navegador sem suporte a createImageBitmap/canvas — guarda o arquivo original
    return file;
  }
}
