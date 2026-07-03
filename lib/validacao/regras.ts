// Motor de validação — Fase 6. Código determinístico, sem IA nenhuma:
// só as 4 regras que sobraram do escopo enxuto (o bloqueio de KM menor já
// é tratado separadamente em /api/abastecimentos, antes do insert — não é
// um "alerta", é bloqueio real). Cada regra é uma função pura que recebe um
// contexto já resolvido (nada de query aqui dentro) e devolve um alerta ou
// null — assim dá pra testar isoladamente sem precisar de banco.

export type NivelAlerta = "info" | "atencao" | "critico";

export interface AlertaGerado {
  tipoRegra: string;
  nivel: NivelAlerta;
  detalhes: Record<string, unknown>;
}

export interface ContextoAvaliacao {
  abastecimento: {
    litros: number;
    kmRodado: number | null;
    consumoKml: number | null;
    numeroNota: string | null;
    // "YYYY-MM-DD" — usado só pela regra de EXIF, pra comparar com o
    // timestamp da foto.
    dataAbastecimento: string;
  };
  veiculo: {
    capacidadeTanqueLitros: number | null;
  };
  // Resolvidos via query fora deste módulo (RLS/JOIN não pertencem a uma função pura).
  notaDuplicada: boolean;
  fotoDuplicada: boolean;
  // Média de consumo dos últimos abastecimentos ativos do veículo, excluindo
  // o atual — null se não houver histórico suficiente pra comparar.
  consumoMedioHistorico: number | null;
  // DateTimeOriginal do EXIF da foto (ISO 8601), lido no servidor
  // (lib/exif.ts) — null sempre que a foto não tiver metadado (print,
  // WhatsApp, PNG, etc.). Ausência NUNCA gera alerta: é o caso normal.
  fotoExifTimestamp: string | null;
}

// Parâmetros ajustáveis das heurísticas — nenhum deles veio de teste
// estatístico real, são pontos de partida razoáveis pro piloto.
const TOLERANCIA_DESVIO_CONSUMO = 0.25; // 25% de desvio da média do próprio veículo
const CONSUMO_MINIMO_KML_ACEITAVEL = 1; // abaixo disso é fisicamente suspeito p/ qualquer veículo

function avaliarCapacidadeTanque(ctx: ContextoAvaliacao): AlertaGerado | null {
  const { litros } = ctx.abastecimento;
  const { capacidadeTanqueLitros } = ctx.veiculo;
  if (capacidadeTanqueLitros == null || litros <= capacidadeTanqueLitros) return null;

  return {
    tipoRegra: "litros_acima_capacidade_tanque",
    nivel: "critico",
    detalhes: { litros, capacidade_tanque_litros: capacidadeTanqueLitros },
  };
}

function avaliarNotaDuplicada(ctx: ContextoAvaliacao): AlertaGerado | null {
  if (!ctx.notaDuplicada) return null;

  return {
    tipoRegra: "nota_fiscal_duplicada",
    nivel: "critico",
    detalhes: { numero_nota: ctx.abastecimento.numeroNota },
  };
}

function avaliarFotoDuplicada(ctx: ContextoAvaliacao): AlertaGerado | null {
  if (!ctx.fotoDuplicada) return null;

  return {
    tipoRegra: "foto_comprovante_duplicada",
    nivel: "critico",
    detalhes: {},
  };
}

// Compara com a média HISTÓRICA do próprio veículo — só faz sentido quando
// já existe base de comparação (senão fica "morno" nos primeiros registros).
function avaliarConsumoForaDaFaixa(ctx: ContextoAvaliacao): AlertaGerado | null {
  const { consumoKml } = ctx.abastecimento;
  const media = ctx.consumoMedioHistorico;
  if (consumoKml == null || media == null || media <= 0) return null;

  const desvio = Math.abs(consumoKml - media) / media;
  if (desvio <= TOLERANCIA_DESVIO_CONSUMO) return null;

  return {
    tipoRegra: "consumo_fora_da_faixa_historica",
    nivel: "atencao",
    detalhes: {
      consumo_kml: consumoKml,
      media_historica_kml: Number(media.toFixed(2)),
      desvio_percentual: Number((desvio * 100).toFixed(1)),
    },
  };
}

// Limiar ABSOLUTO (não depende de histórico do veículo) — pega o caso de um
// veículo novo, sem baseline ainda, com consumo implícito fisicamente
// implausível. Pode disparar junto com a regra acima pro mesmo evento —
// isso é esperado, são checagens complementares, não mutuamente exclusivas.
function avaliarLitrosDesproporcionais(ctx: ContextoAvaliacao): AlertaGerado | null {
  const { kmRodado, litros } = ctx.abastecimento;
  if (kmRodado == null || kmRodado <= 0 || litros <= 0) return null;

  const consumoImplicito = kmRodado / litros;
  if (consumoImplicito >= CONSUMO_MINIMO_KML_ACEITAVEL) return null;

  return {
    tipoRegra: "litros_desproporcionais_ao_km_rodado",
    nivel: "atencao",
    detalhes: {
      km_rodado: kmRodado,
      litros,
      consumo_implicito_kml: Number(consumoImplicito.toFixed(2)),
    },
  };
}

// Tolerância pra regra de EXIF — foto tirada mais de 48h ANTES da data
// informada do abastecimento é suspeita de reaproveitamento (galeria antiga,
// comprovante de outro dia). Não penaliza foto tirada DEPOIS da data
// informada: registrar um abastecimento atrasado (foto tirada hoje, data
// informada de ontem) é um fluxo legítimo e comum, não fraude.
const TOLERANCIA_HORAS_FOTO_ANTIGA = 48;

// Camada de SUSPEITA, não de bloqueio (ver lib/exif.ts): ausência de EXIF
// (print, WhatsApp, PNG, galeria que apaga metadado) nunca gera alerta — só
// dispara quando HÁ metadado e ele diverge demais da data informada.
function avaliarFotoAntigaOuReaproveitada(ctx: ContextoAvaliacao): AlertaGerado | null {
  const { fotoExifTimestamp } = ctx;
  if (!fotoExifTimestamp) return null;

  const dataFoto = new Date(fotoExifTimestamp);
  if (Number.isNaN(dataFoto.getTime())) return null;

  // Fim do dia informado (23:59:59 UTC) — margem generosa que evita falso
  // positivo por causa só de fuso horário entre o relógio da câmera e o
  // horário do servidor.
  const dataInformada = new Date(`${ctx.abastecimento.dataAbastecimento}T23:59:59.000Z`);
  if (Number.isNaN(dataInformada.getTime())) return null;

  const horasDeDiferenca = (dataInformada.getTime() - dataFoto.getTime()) / (1000 * 60 * 60);
  if (horasDeDiferenca <= TOLERANCIA_HORAS_FOTO_ANTIGA) return null;

  return {
    tipoRegra: "foto_antiga_ou_reaproveitada",
    nivel: "atencao",
    detalhes: {
      exif_timestamp: fotoExifTimestamp,
      data_abastecimento: ctx.abastecimento.dataAbastecimento,
      horas_de_diferenca: Number(horasDeDiferenca.toFixed(1)),
    },
  };
}

export function avaliarAbastecimento(ctx: ContextoAvaliacao): AlertaGerado[] {
  return [
    avaliarCapacidadeTanque(ctx),
    avaliarNotaDuplicada(ctx),
    avaliarFotoDuplicada(ctx),
    avaliarConsumoForaDaFaixa(ctx),
    avaliarLitrosDesproporcionais(ctx),
    avaliarFotoAntigaOuReaproveitada(ctx),
  ].filter((alerta): alerta is AlertaGerado => alerta !== null);
}

// Bloqueio real (invariante #6), não um alerta — extraído aqui como função
// pura só pra ficar testável junto do resto do motor. Usado em
// /api/abastecimentos antes do insert. `kmUltimoRegistrado` null significa
// "primeiro abastecimento do veículo" — nunca bloqueia nesse caso.
export function kmMenorQueUltimoRegistrado(
  kmAtual: number,
  kmUltimoRegistrado: number | null
): boolean {
  return kmUltimoRegistrado != null && kmAtual < kmUltimoRegistrado;
}
