import { listarFila, removerDaFila, atualizarItemFila, type ItemFila } from "@/lib/offline/db";

function construirFormData(item: ItemFila): FormData {
  const formData = new FormData();
  formData.set("qr_token", item.qrToken);
  formData.set("origem_registro", "fila_offline");
  for (const [chave, valor] of Object.entries(item.payload)) {
    formData.set(chave, valor);
  }
  if (item.fotoBlob) {
    formData.set("foto_cupom", item.fotoBlob, item.fotoNome ?? "comprovante.jpg");
  }
  if (item.fotoExifHeaderBlob) {
    formData.set("foto_cupom_exif", item.fotoExifHeaderBlob, item.fotoNome ?? "comprovante.jpg");
  }
  // Bomba/hodômetro são opcionais no item (itens enfileirados antes deste
  // recurso existir nunca terão essas chaves — `undefined`, tratado igual a
  // "não fotografou essa etapa").
  if (item.fotoBombaBlob) {
    formData.set("foto_bomba", item.fotoBombaBlob, item.fotoBombaNome ?? "bomba.jpg");
  }
  if (item.fotoBombaExifHeaderBlob) {
    formData.set("foto_bomba_exif", item.fotoBombaExifHeaderBlob, item.fotoBombaNome ?? "bomba.jpg");
  }
  if (item.fotoHodometroBlob) {
    formData.set("foto_hodometro", item.fotoHodometroBlob, item.fotoHodometroNome ?? "hodometro.jpg");
  }
  if (item.fotoHodometroExifHeaderBlob) {
    formData.set(
      "foto_hodometro_exif",
      item.fotoHodometroExifHeaderBlob,
      item.fotoHodometroNome ?? "hodometro.jpg"
    );
  }
  return formData;
}

let sincronizando = false;

// Reenvia cada item da fila pro mesmo endpoint que o fluxo online usa —
// registro_uuid garante que reenviar não duplica (idempotência já validada
// na Fase 3). Erro de validação/negócio (4xx) marca o item e segue pro
// próximo; erro de rede para tudo (ainda sem conexão de verdade) e tenta de
// novo na próxima chamada.
export async function sincronizarFila(): Promise<void> {
  if (sincronizando) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  sincronizando = true;
  try {
    const itens = await listarFila();

    for (const item of itens) {
      try {
        const resposta = await fetch("/api/abastecimentos", {
          method: "POST",
          body: construirFormData(item),
        });

        if (resposta.ok) {
          await removerDaFila(item.registroUuid);
          continue;
        }

        const resultado = await resposta.json().catch(() => null);
        await atualizarItemFila(item.registroUuid, {
          status: "erro",
          erro: resultado?.error ?? `Erro ${resposta.status}`,
          tentativas: item.tentativas + 1,
        });
      } catch {
        break;
      }
    }
  } finally {
    sincronizando = false;
  }
}
