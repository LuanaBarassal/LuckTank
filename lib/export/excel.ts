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
const CINZA_TEXTO = "FF64748B";
const BORDA = "FFE5E7EB";
const BRANCO = "FFFFFFFF";

const FORMATO_MOEDA = '"R$"#,##0.00';

// Sem `header` na config de coluna — ExcelJS só auto-escreve a linha 1 como
// cabeçalho quando `header` está presente; aqui o cabeçalho de identificação
// (empresa/veículo/período/médias) ocupa as primeiras linhas, então o
// cabeçalho da TABELA é escrito manualmente mais abaixo, na posição certa.
const COLUNAS = [
  { key: "data", width: 12 },
  { key: "veiculo", width: 14 },
  { key: "motorista", width: 24 },
  { key: "km", width: 10 },
  { key: "kmRodado", width: 12 },
  { key: "litros", width: 10 },
  { key: "precoLitro", width: 11 },
  { key: "total", width: 12 },
  { key: "consumo", width: 14 },
  { key: "posto", width: 26 },
  { key: "cidade", width: 18 },
  { key: "nota", width: 14 },
  { key: "alertas", width: 44 },
  { key: "foto", width: 12 },
] as const;

const TITULOS_TABELA = [
  "Data",
  "Veículo",
  "Motorista",
  "KM",
  "KM rodado",
  "Litros",
  "R$/litro",
  "Total",
  "Consumo (km/L)",
  "Posto",
  "Cidade",
  "Nº nota",
  "Alertas",
  "Foto",
];

const NUM_COLUNAS = COLUNAS.length;

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
    properties: { tabColor: { argb: NAVY } },
  });
  sheet.columns = [...COLUNAS];

  // ── Cabeçalho de identificação — bem no topo da MESMA aba que tem a
  // tabela, antes dela, pra ninguém precisar trocar de aba/rolar até o fim
  // do arquivo pra achar essa informação (era o problema real: antes ela só
  // existia numa aba "Resumo" separada, fácil de não notar).
  const linhaTitulo = sheet.addRow(["LuckTank — Relatório de Abastecimentos"]);
  sheet.mergeCells(linhaTitulo.number, 1, linhaTitulo.number, NUM_COLUNAS);
  linhaTitulo.height = 26;
  linhaTitulo.getCell(1).font = { bold: true, size: 15, color: { argb: BRANCO } };
  linhaTitulo.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  linhaTitulo.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const identidade = [
    `Empresa: ${cabecalho.empresaNome}`,
    cabecalho.veiculoLabel ? `Veículo: ${cabecalho.veiculoLabel}` : null,
    `Período: ${cabecalho.periodoTexto}`,
  ]
    .filter(Boolean)
    .join("   ·   ");
  const linhaIdentidade = sheet.addRow([identidade]);
  sheet.mergeCells(linhaIdentidade.number, 1, linhaIdentidade.number, NUM_COLUNAS);
  linhaIdentidade.getCell(1).font = { bold: true, size: 11, color: { argb: NAVY } };

  const linhaFiltros = sheet.addRow([`Filtros aplicados: ${cabecalho.filtrosTexto}`]);
  sheet.mergeCells(linhaFiltros.number, 1, linhaFiltros.number, NUM_COLUNAS);
  linhaFiltros.getCell(1).font = { italic: true, size: 9, color: { argb: CINZA_TEXTO } };

  sheet.addRow([]);

  // ── Médias do período — mesmos 3 números dos cards da tela (calculados
  // fora daqui, em lib/onibus/estatisticas.ts, e só passados adiante), com
  // a mesma contagem de registros que embasa cada uma.
  if (medias) {
    const linhaTituloMedias = sheet.addRow(["Médias no período filtrado"]);
    sheet.mergeCells(linhaTituloMedias.number, 1, linhaTituloMedias.number, NUM_COLUNAS);
    linhaTituloMedias.getCell(1).font = { bold: true, size: 12, color: { argb: NAVY } };

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
    for (const texto of linhasMedia) {
      const linha = sheet.addRow([texto]);
      sheet.mergeCells(linha.number, 1, linha.number, NUM_COLUNAS);
      linha.getCell(1).font = { size: 10, color: { argb: "FF334155" } };
    }
    sheet.addRow([]);
  }

  // ── Cabeçalho da tabela
  const headerRow = sheet.addRow(TITULOS_TABELA);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: BRANCO } };
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
    // Alertas pode ter vários rótulos concatenados (bem mais que os 44
    // caracteres da largura da coluna) — sem quebra de linha, o Excel só
    // corta visualmente o texto na tela (a célula continua com o valor
    // inteiro, só não aparece inteiro sem clicar) — `wrapText` evita isso.
    row.getCell("alertas").alignment = { wrapText: true, vertical: "top" };
    row.getCell("posto").alignment = { wrapText: true, vertical: "top" };

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

  // Linha de TOTAIS — soma as 3 colunas somáveis (KM rodado, Litros, Total),
  // igual à linha de total que já existe na tela (Bloco 2). KM rodado só
  // soma registros com km_rodado válido (mesma regra de sempre); Litros e
  // Total somam todos os registros — `resumo` já vem com essa distinção
  // pronta (lib/export/resumo.ts), não recalculado aqui.
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
    cell.border = {
      top: { style: "medium", color: { argb: NAVY } },
      bottom: { style: "medium", color: { argb: NAVY } },
    };
  });

  // Painel fixo logo abaixo do cabeçalho da TABELA (não da linha 1) — ao
  // rolar, o bloco de identificação/médias some de vista, mas o cabeçalho
  // das colunas continua visível.
  sheet.views = [{ state: "frozen", ySplit: headerRow.number }];

  // ── Aba "Resumo" — mesma informação em formato compacto de referência,
  // útil pra imprimir só essa página ou colar em outro lugar; a informação
  // "de verdade" já está garantida visível na aba principal acima.
  const resumoSheet = workbook.addWorksheet("Resumo", {
    properties: { tabColor: { argb: CYAN } },
  });
  resumoSheet.columns = [
    { key: "rotulo", width: 30 },
    { key: "valor", width: 40 },
  ];

  const tituloRow = resumoSheet.addRow(["LuckTank — Relatório de abastecimentos"]);
  tituloRow.font = { bold: true, size: 14, color: { argb: NAVY } };
  resumoSheet.addRow([]);

  const linhas: [string, string | number][] = [
    ["Empresa", cabecalho.empresaNome],
    ...(cabecalho.veiculoLabel ? ([["Veículo", cabecalho.veiculoLabel]] as [string, string][]) : []),
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
