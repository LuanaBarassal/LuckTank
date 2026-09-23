import "server-only";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { formatarCnpj, formatarTelefone } from "@/lib/formatacao";
import { AVISO_OFFLINE, PASSOS_MOTORISTA } from "./conteudo";

// Etiqueta do QR do veículo como PDF de verdade (A4, 1 página) — a
// alternativa ao "imprimir página web" do navegador, que injeta cabeçalho/
// rodapé próprios (data, título, URL, "1/2") e pode quebrar a página conforme
// margem/zoom/impressora de cada um. Aqui o LuckTank controla 100% do que sai
// no papel. Mesma lib dos exports (jspdf — ver PROJETO.md: embute fontes
// padrão como dado JS, sem ler arquivo do disco na function da Vercel).
// Layout espelha a página de impressão (onibus/[id]/etiqueta): identificador
// → QR grande → "Como abastecer" | "Dados para a nota fiscal". Preto sobre
// branco (impressora P&B).

export interface DadosEtiqueta {
  veiculoLabel: string; // "prefixo · placa" já formatado
  modeloAno: string | null; // "Modelo · 2020"
  qrUrl: string; // URL /r/<qr_token> — vira o QR desenhado em vetor
  notaFiscal: { cnpj: string | null; whatsapp: string | null; email: string | null } | null;
}

const A4_LARGURA = 210;
const A4_ALTURA = 297;
const MARGEM = 14;
const PRETO: [number, number, number] = [15, 15, 15];
const CINZA: [number, number, number] = [90, 90, 90];

// Reduz a fonte até o texto caber na largura (e-mail comprido numa coluna
// estreita, por exemplo) — nunca deixa vazar pra fora do bloco.
function escreverAjustado(
  doc: jsPDF,
  texto: string,
  x: number,
  y: number,
  larguraMax: number,
  tamanhoInicial: number,
  opcoes: { align?: "left" | "center" } = {}
) {
  let tamanho = tamanhoInicial;
  doc.setFontSize(tamanho);
  while (doc.getTextWidth(texto) > larguraMax && tamanho > 7) {
    tamanho -= 0.5;
    doc.setFontSize(tamanho);
  }
  doc.text(texto, x, y, { align: opcoes.align ?? "left" });
}

// QR desenhado em VETOR (um retângulo preto por trecho de módulos), a partir
// da mesma lib/configuração do QR de download (lib/qr.ts: `qrcode`, correção
// "M", zona de silêncio de 2 módulos). Embutir o PNG deixava o PDF com ~3MB
// (jsPDF grava os pixels crus); em vetor fica com poucos KB e nítido em
// qualquer impressora/tamanho. Trechos horizontais contíguos viram um
// retângulo só (menos comandos, sem "costura" visível entre módulos).
export const MARGEM_QR_MODULOS = 2;

export function desenharQrVetorial(doc: jsPDF, url: string, x: number, y: number, lado: number) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  const total = modules.size + 2 * MARGEM_QR_MODULOS;
  const modulo = lado / total;
  doc.setFillColor(0, 0, 0);
  for (let linha = 0; linha < modules.size; linha++) {
    let coluna = 0;
    while (coluna < modules.size) {
      if (!modules.get(linha, coluna)) {
        coluna++;
        continue;
      }
      const inicio = coluna;
      while (coluna < modules.size && modules.get(linha, coluna)) coluna++;
      doc.rect(
        x + (inicio + MARGEM_QR_MODULOS) * modulo,
        y + (linha + MARGEM_QR_MODULOS) * modulo,
        (coluna - inicio) * modulo,
        modulo,
        "F"
      );
    }
  }
}

export function gerarEtiquetaPdf(dados: DadosEtiqueta): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const centroX = A4_LARGURA / 2;
  doc.setTextColor(...PRETO);
  doc.setDrawColor(...PRETO);

  // ── Identificador (uma vez só, em destaque)
  let y = MARGEM + 10;
  doc.setFont("helvetica", "bold");
  escreverAjustado(doc, dados.veiculoLabel, centroX, y, A4_LARGURA - 2 * MARGEM, 32, { align: "center" });
  if (dados.modeloAno) {
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...CINZA);
    doc.setFontSize(13);
    doc.text(dados.modeloAno, centroX, y, { align: "center" });
    doc.setTextColor(...PRETO);
  }

  // ── QR grande, centralizado
  const ladoQr = 92;
  y += 4;
  desenharQrVetorial(doc, dados.qrUrl, centroX - ladoQr / 2, y, ladoQr);
  y += ladoQr + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Escaneie com a câmera do celular para registrar o abastecimento", centroX, y, { align: "center" });

  y += 6;
  doc.setLineWidth(0.3);
  doc.line(MARGEM, y, A4_LARGURA - MARGEM, y);
  const topoColunas = y + 8;

  // ── Coluna esquerda: Como abastecer
  const temNota = Boolean(dados.notaFiscal && (dados.notaFiscal.cnpj || dados.notaFiscal.whatsapp || dados.notaFiscal.email));
  const larguraNota = 70;
  const xNota = A4_LARGURA - MARGEM - larguraNota;
  const larguraPassos = (temNota ? xNota - 7 : A4_LARGURA - MARGEM) - MARGEM;

  let yPassos = topoColunas;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("COMO ABASTECER", MARGEM, yPassos);
  yPassos += 7;

  const tamanhoPasso = 10.5;
  const alturaLinha = tamanhoPasso * 0.3528 * 1.3; // pt → mm, com entrelinha
  PASSOS_MOTORISTA.forEach((passo, indice) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setLineWidth(0.45);
    doc.circle(MARGEM + 2.6, yPassos - 1.3, 2.6, "S");
    doc.text(String(indice + 1), MARGEM + 2.6, yPassos - 0.2, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(tamanhoPasso);
    const linhas: string[] = doc.splitTextToSize(passo, larguraPassos - 8);
    doc.text(linhas, MARGEM + 8, yPassos);
    yPassos += linhas.length * alturaLinha + 2.2;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CINZA);
  doc.text(doc.splitTextToSize(AVISO_OFFLINE, larguraPassos) as string[], MARGEM, yPassos + 1);
  doc.setTextColor(...PRETO);

  // ── Coluna direita: Dados para a nota fiscal (caixa com borda)
  if (temNota && dados.notaFiscal) {
    const nota = dados.notaFiscal;
    const xMeio = xNota + larguraNota / 2;
    const larguraTexto = larguraNota - 8;
    let yn = topoColunas + 1;
    const topoCaixa = topoColunas - 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("DADOS PARA A", xMeio, yn, { align: "center" });
    doc.text("NOTA FISCAL", xMeio, yn + 5, { align: "center" });
    yn += 14;

    if (nota.cnpj) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...CINZA);
      doc.text("Emitir no CNPJ", xMeio, yn, { align: "center" });
      doc.setTextColor(...PRETO);
      yn += 7;
      doc.setFont("helvetica", "bold");
      escreverAjustado(doc, formatarCnpj(nota.cnpj), xMeio, yn, larguraTexto, 16, { align: "center" });
      yn += 11;
    }

    const destinos = [nota.whatsapp ? formatarTelefone(nota.whatsapp) : null, nota.email].filter(
      (d): d is string => Boolean(d)
    );
    if (destinos.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...CINZA);
      doc.text("Enviar comprovante para", xMeio, yn, { align: "center" });
      doc.setTextColor(...PRETO);
      yn += 7;
      destinos.forEach((destino, indice) => {
        if (indice > 0) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(...CINZA);
          doc.text("ou", xMeio, yn, { align: "center" });
          doc.setTextColor(...PRETO);
          yn += 6;
        }
        doc.setFont("helvetica", "bold");
        escreverAjustado(doc, destino, xMeio, yn, larguraTexto, 13, { align: "center" });
        yn += 7;
      });
    }

    doc.setLineWidth(0.6);
    doc.roundedRect(xNota, topoCaixa, larguraNota, yn - topoCaixa, 3, 3, "S");
  }

  // Rodapé discreto — do próprio LuckTank, não do navegador.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...CINZA);
  doc.text("LuckTank — controle de combustível", centroX, A4_ALTURA - 8, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}
