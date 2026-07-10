import "server-only";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatarDataBr, formatarMoeda } from "@/lib/formatacao";
import type { EstatisticasVeiculo } from "@/lib/onibus/estatisticas";
import type { CabecalhoExport, RegistroExport, ResumoExport } from "./tipos";
import type { FotoBaixada } from "@/lib/midias";

// Mesma paleta navy/ciano do Excel (ver lib/export/excel.ts) e do resto do
// produto — jsPDF trabalha com RGB (0-255), não hex ARGB como o ExcelJS.
const NAVY: [number, number, number] = [10, 22, 40];
const CYAN: [number, number, number] = [0, 212, 255];
const CINZA_CLARO: [number, number, number] = [248, 250, 252];
const CINZA_TEXTO: [number, number, number] = [51, 65, 85];
const PRETO: [number, number, number] = [20, 20, 20];

// As 3 fotos da captura guiada (Bloco 5), cada uma opcional — bomba/
// hodômetro são fotos opcionais desde o Bloco 1, então nem toda linha tem
// as 3.
export interface FotosLinhaPdf {
  cupom?: FotoBaixada;
  bomba?: FotoBaixada;
  hodometro?: FotoBaixada;
}

// `fotos` é indexado pela posição do registro no array (não por id) — mais
// simples do que inventar uma chave sintética só pra esse mapeamento local
// entre a tabela e as miniaturas desenhadas em cima dela.
export function gerarPdf(
  cabecalho: CabecalhoExport,
  registros: RegistroExport[],
  resumo: ResumoExport,
  fotos: Map<number, FotosLinhaPdf>,
  // Só presente no export de dentro da aba de um ônibus específico — ver
  // mesma observação em lib/export/excel.ts.
  medias?: EstatisticasVeiculo
): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();

  // ── Faixa navy no topo — identidade + período/filtros
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, largura, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("LuckTank", 10, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CYAN);
  const subtitulo = cabecalho.veiculoLabel
    ? `${cabecalho.empresaNome} — Veículo ${cabecalho.veiculoLabel}`
    : `${cabecalho.empresaNome} — Relatório de abastecimentos`;
  doc.text(subtitulo, 10, 17);

  doc.setTextColor(...CINZA_TEXTO);
  doc.setFontSize(9);
  doc.text(`Período: ${cabecalho.periodoTexto}`, 10, 29);
  doc.text(`Filtros: ${cabecalho.filtrosTexto}`, 10, 34);

  // ── Médias do período — logo no topo, ANTES da tabela (era o problema
  // real do layout anterior: só aparecia depois da tabela, no fim da
  // página/documento, fácil de não notar). Mesmos 3 números dos cards da
  // tela, mesma contagem de registros que embasa cada um.
  let proximaLinhaY = 41;
  if (medias) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PRETO);
    doc.text("Médias no período filtrado", 10, proximaLinhaY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CINZA_TEXTO);
    const linhasMedia = [
      `Consumo médio (km/L): ${
        medias.consumoMedioKml != null
          ? `${medias.consumoMedioKml.toFixed(2)} (sobre ${medias.abastecimentosComKmValido} registro(s) válido(s))`
          : "—"
      }`,
      `Custo médio por km (R$/km): ${
        medias.custoMedioPorKm != null
          ? `${formatarMoeda(medias.custoMedioPorKm)} (sobre ${medias.abastecimentosComKmValido} registro(s) válido(s))`
          : "—"
      }`,
      `Gasto médio por abastecimento (R$): ${
        medias.gastoMedioPorAbastecimento != null
          ? `${formatarMoeda(medias.gastoMedioPorAbastecimento)} (sobre ${medias.totalAbastecimentos} registro(s))`
          : "—"
      }`,
    ];
    linhasMedia.forEach((linha, indice) => doc.text(linha, 10, proximaLinhaY + 5 + indice * 5));
    proximaLinhaY += 5 + linhasMedia.length * 5 + 4;
  }

  const colunas = [
    "Foto",
    "Data",
    "Veículo",
    "Motorista",
    "KM",
    "KM rodado",
    "Litros",
    "R$/L",
    "Total",
    "Consumo",
    "Posto",
    "Nota",
    "Alertas",
  ];

  const linhas = registros.map((r) => [
    "",
    formatarDataBr(r.data),
    r.veiculoPlaca,
    r.motorista,
    String(r.kmAtual),
    r.kmRodado != null ? String(r.kmRodado) : "—",
    `${r.litros} L`,
    r.valorPorLitro != null ? formatarMoeda(r.valorPorLitro) : "—",
    formatarMoeda(r.valorTotal),
    r.consumoKml != null ? r.consumoKml.toFixed(2) : "—",
    r.postoNome ?? "—",
    r.numeroNota ?? "—",
    r.alertas.join(", ") || "—",
  ]);

  autoTable(doc, {
    startY: proximaLinhaY,
    head: [colunas],
    body: linhas,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: CINZA_CLARO },
    styles: { fontSize: 7, cellPadding: 1.8, minCellHeight: 10, valign: "middle", overflow: "linebreak" },
    // Posto e Alertas são os campos mais longos — largura mínima maior pra
    // não ficar ilegível/cortado (autoTable quebra linha automaticamente
    // dentro da largura da coluna, então "cortado" aqui seria só ficar
    // estreito demais pra ler, não perda de dado).
    columnStyles: {
      0: { cellWidth: 20 }, // Fotos (cupom + bomba + hodômetro lado a lado)
      10: { cellWidth: 30 }, // Posto
      12: { cellWidth: 40 }, // Alertas
    },
    didDrawCell: (dados) => {
      if (dados.section !== "body" || dados.column.index !== 0) return;
      const linha = fotos.get(dados.row.index);
      if (!linha) return;

      // 3 miniaturas lado a lado, cada uma ~6mm de largura — a coluna é
      // estreita demais pra rótulo (esse já existe na tela do escritório,
      // ver components/escritorio/foto-comprovante.tsx); aqui é só indicar
      // visualmente que a foto existe.
      [linha.cupom, linha.bomba, linha.hodometro].forEach((foto, indice) => {
        if (!foto || !foto.formatoPdf) return;
        try {
          doc.addImage(
            foto.buffer.toString("base64"),
            foto.formatoPdf,
            dados.cell.x + 1 + indice * 6,
            dados.cell.y + 1,
            5.5,
            8,
            undefined,
            "FAST"
          );
        } catch {
          // Foto corrompida/formato inesperado — deixa aquela miniatura em
          // branco em vez de derrubar o relatório inteiro por causa disso.
        }
      });
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable estende o doc dinamicamente, sem tipo próprio pra isso
  let finalY = (doc as any).lastAutoTable.finalY + 10;

  // Espaço estimado pro bloco de totais recapitulados — se não couber no
  // que sobrou da página, começa uma página nova em vez de estourar a
  // margem inferior (jsPDF não quebra texto solto sozinho, só linhas de
  // autoTable).
  const alturaEstimada = 16 + 6 * 5;
  const alturaPagina = doc.internal.pageSize.getHeight();
  if (finalY + alturaEstimada > alturaPagina - 10) {
    doc.addPage();
    finalY = 20;
  }

  doc.setTextColor(...PRETO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Totais do período", 10, finalY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...CINZA_TEXTO);
  const resumoLinhas = [
    `Registros: ${resumo.quantidadeRegistros}`,
    `Total de KM rodado: ${resumo.totalKmRodado} km`,
    `Total de litros: ${resumo.totalLitros.toFixed(1)} L`,
    `Total gasto: ${formatarMoeda(resumo.totalValor)}`,
    `Preço médio por litro: ${resumo.precoMedioLitro != null ? formatarMoeda(resumo.precoMedioLitro) : "—"}`,
    `Consumo médio: ${resumo.consumoMedioKml != null ? `${resumo.consumoMedioKml.toFixed(2)} km/L` : "—"}`,
  ];
  resumoLinhas.forEach((linha, indice) => doc.text(linha, 10, finalY + 6 + indice * 5));

  return Buffer.from(doc.output("arraybuffer"));
}
