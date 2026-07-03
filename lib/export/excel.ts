import "server-only";
import ExcelJS from "exceljs";
import { formatarDataBr, formatarMoeda } from "@/lib/formatacao";
import type { EstatisticasVeiculo } from "@/lib/onibus/estatisticas";
import type { CabecalhoExport, RegistroExport, ResumoExport } from "./tipos";

// Paleta navy/ciano — mesma usada no LuckFrota (produto irmão, ver
// tailwind.config.ts e PROJETO.md) pra manter os exports "família" com o
// resto do produto. ExcelJS usa ARGB (FF = alpha opaco).
const NAVY = "FF0A1628";
const CYAN_ESCURO = "FF00A8CC";
const CYAN = "FF00D4FF";
const CINZA_CLARO = "FFF8FAFC";
const BORDA = "FFE5E7EB";

const FORMATO_MOEDA = '"R$"#,##0.00';

export async function gerarExcel(
  cabecalho: CabecalhoExport,
  registros: RegistroExport[],
  resumo: ResumoExport,
  // Só presente no export de dentro da aba de um ônibus específico (um
  // único veículo filtrado) — as mesmas 3 médias que já aparecem nos cards
  // da tela (lib/onibus/estatisticas.ts, mesma função, mesmo dado), pra
  // nunca divergir do que o usuário está vendo. `undefined` no export geral
  // do dashboard, onde "consumo médio de vários veículos juntos" não faz o
  // mesmo sentido.
  medias?: EstatisticasVeiculo
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LuckTank";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Abastecimentos", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { tabColor: { argb: NAVY } },
  });

  sheet.columns = [
    { header: "Data", key: "data", width: 12 },
    { header: "Veículo", key: "veiculo", width: 12 },
    { header: "Motorista", key: "motorista", width: 24 },
    { header: "KM", key: "km", width: 10 },
    { header: "KM rodado", key: "kmRodado", width: 12 },
    { header: "Litros", key: "litros", width: 10 },
    { header: "R$/litro", key: "precoLitro", width: 10 },
    { header: "Total", key: "total", width: 12 },
    { header: "Consumo (km/L)", key: "consumo", width: 14 },
    { header: "Posto", key: "posto", width: 22 },
    { header: "Cidade", key: "cidade", width: 16 },
    { header: "Nº nota", key: "nota", width: 14 },
    { header: "Alertas", key: "alertas", width: 34 },
    { header: "Foto", key: "foto", width: 12 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  registros.forEach((r, indice) => {
    const row = sheet.addRow({
      data: formatarDataBr(r.data),
      veiculo: r.veiculoPlaca,
      motorista: r.motorista,
      km: r.kmAtual,
      kmRodado: r.kmRodado ?? "—",
      litros: r.litros,
      precoLitro: r.valorPorLitro ?? "",
      total: r.valorTotal,
      consumo: r.consumoKml != null ? Number(r.consumoKml.toFixed(2)) : "—",
      posto: r.postoNome ?? "",
      cidade: r.postoCidade ?? "",
      nota: r.numeroNota ?? "",
      alertas: r.alertas.join(", "),
      foto: r.fotoUrl ? "Ver foto" : "—",
    });

    row.getCell("total").numFmt = FORMATO_MOEDA;
    if (typeof r.valorPorLitro === "number") row.getCell("precoLitro").numFmt = FORMATO_MOEDA;

    // Link clicável — célula separada (não embutida em texto de outra
    // coluna), como pedido: quem abre o Excel clica em "Ver foto" e vai
    // direto pra rota autenticada que serve a imagem.
    if (r.fotoUrl) {
      const cell = row.getCell("foto");
      cell.value = { text: "Ver foto", hyperlink: r.fotoUrl };
      cell.font = { color: { argb: CYAN_ESCURO }, underline: true };
    }

    if (indice % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA_CLARO } };
      });
    }

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: BORDA } },
        bottom: { style: "thin", color: { argb: BORDA } },
      };
    });
  });

  // Linha de totais ao final da própria aba (além do resumo mais completo
  // na aba separada abaixo) — soma bruta de litros/valor, visível junto da
  // tabela sem precisar trocar de aba.
  const totaisRow = sheet.addRow({
    data: "TOTAIS",
    kmRodado: resumo.totalKmRodado,
    litros: resumo.totalLitros,
    total: resumo.totalValor,
  });
  totaisRow.font = { bold: true };
  totaisRow.getCell("total").numFmt = FORMATO_MOEDA;
  totaisRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CYAN } };
    cell.font = { bold: true, color: { argb: NAVY } };
  });

  const resumoSheet = workbook.addWorksheet("Resumo", {
    properties: { tabColor: { argb: CYAN } },
  });
  resumoSheet.columns = [
    { key: "rotulo", width: 26 },
    { key: "valor", width: 34 },
  ];

  const tituloRow = resumoSheet.addRow(["LuckTank — Relatório de abastecimentos"]);
  tituloRow.font = { bold: true, size: 14, color: { argb: NAVY } };
  resumoSheet.addRow([]);

  const linhas: [string, string | number][] = [
    ["Empresa", cabecalho.empresaNome],
    ["Período", cabecalho.periodoTexto],
    ["Filtros aplicados", cabecalho.filtrosTexto],
    ["Quantidade de registros", resumo.quantidadeRegistros],
    ["Total de KM rodado", `${resumo.totalKmRodado} km`],
    ["Total de litros", `${resumo.totalLitros.toFixed(1)} L`],
    ["Total gasto", formatarMoeda(resumo.totalValor)],
    [
      "Preço médio por litro",
      resumo.precoMedioLitro != null ? formatarMoeda(resumo.precoMedioLitro) : "—",
    ],
    [
      "Consumo médio (km/L)",
      resumo.consumoMedioKml != null ? resumo.consumoMedioKml.toFixed(2) : "—",
    ],
  ];
  for (const [rotulo, valor] of linhas) {
    const row = resumoSheet.addRow([rotulo, valor]);
    row.getCell(1).font = { bold: true };
  }

  if (medias) {
    resumoSheet.addRow([]);
    const tituloMedias = resumoSheet.addRow(["Médias do veículo no período filtrado"]);
    tituloMedias.font = { bold: true, size: 12, color: { argb: NAVY } };

    const linhasMedias: [string, string | number][] = [
      [
        "Consumo médio (km/L)",
        medias.consumoMedioKml != null
          ? `${medias.consumoMedioKml.toFixed(2)} (sobre ${medias.abastecimentosComKmValido} registro(s) válido(s))`
          : "—",
      ],
      [
        "Custo médio por km (R$/km)",
        medias.custoMedioPorKm != null
          ? `${formatarMoeda(medias.custoMedioPorKm)} (sobre ${medias.abastecimentosComKmValido} registro(s) válido(s))`
          : "—",
      ],
      [
        "Gasto médio por abastecimento (R$)",
        medias.gastoMedioPorAbastecimento != null
          ? `${formatarMoeda(medias.gastoMedioPorAbastecimento)} (sobre ${medias.totalAbastecimentos} registro(s))`
          : "—",
      ],
    ];
    for (const [rotulo, valor] of linhasMedias) {
      const row = resumoSheet.addRow([rotulo, valor]);
      row.getCell(1).font = { bold: true };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
