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

// `fotos` é indexado pela posição do registro no array (não por id) — mais
// simples do que inventar uma chave sintética só pra esse mapeamento local
// entre a tabela e as miniaturas desenhadas em cima dela.
export function gerarPdf(
  cabecalho: CabecalhoExport,
  registros: RegistroExport[],
  resumo: ResumoExport,
  fotos: Map<number, FotoBaixada>,
  // Só presente no export de dentro da aba de um ônibus específico — ver
  // mesma observação em lib/export/excel.ts.
  medias?: EstatisticasVeiculo
): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, largura, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("LuckTank", 10, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CYAN);
  doc.text(`${cabecalho.empresaNome} — Relatório de abastecimentos`, 10, 17);

  doc.setTextColor(...CINZA_TEXTO);
  doc.setFontSize(9);
  doc.text(`Período: ${cabecalho.periodoTexto}`, 10, 29);
  doc.text(`Filtros: ${cabecalho.filtrosTexto}`, 10, 34);

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
    startY: 40,
    head: [colunas],
    body: linhas,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: CINZA_CLARO },
    styles: { fontSize: 7, cellPadding: 1.5, minCellHeight: 10, valign: "middle" },
    columnStyles: { 0: { cellWidth: 12 } },
    didDrawCell: (dados) => {
      if (dados.section !== "body" || dados.column.index !== 0) return;
      const foto = fotos.get(dados.row.index);
      if (!foto || !foto.formatoPdf) return;
      try {
        doc.addImage(
          foto.buffer.toString("base64"),
          foto.formatoPdf,
          dados.cell.x + 1,
          dados.cell.y + 1,
          10,
          8,
          undefined,
          "FAST"
        );
      } catch {
        // Foto corrompida/formato inesperado — deixa a célula em branco em
        // vez de derrubar o relatório inteiro por causa de uma miniatura.
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable estende o doc dinamicamente, sem tipo próprio pra isso
  let finalY = (doc as any).lastAutoTable.finalY + 10;

  // Espaço estimado pro bloco de resumo (+ médias, quando presentes) — se
  // não couber no que sobrou da página, começa uma página nova em vez de
  // estourar a margem inferior (jsPDF não quebra texto solto sozinho, só
  // linhas de autoTable).
  const alturaEstimada = 16 + (medias ? 8 * 5 : 5 * 5);
  const alturaPagina = doc.internal.pageSize.getHeight();
  if (finalY + alturaEstimada > alturaPagina - 10) {
    doc.addPage();
    finalY = 20;
  }

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumo do período", 10, finalY);

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

  if (medias) {
    const yMedias = finalY + 6 + resumoLinhas.length * 5 + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text("Médias do veículo no período filtrado", 10, yMedias);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CINZA_TEXTO);
    const linhasMedias = [
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
    linhasMedias.forEach((linha, indice) => doc.text(linha, 10, yMedias + 6 + indice * 5));
  }

  return Buffer.from(doc.output("arraybuffer"));
}
