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

export function avaliarAbastecimento(ctx: ContextoAvaliacao): AlertaGerado[] {
  return [
    avaliarCapacidadeTanque(ctx),
    avaliarNotaDuplicada(ctx),
    avaliarFotoDuplicada(ctx),
    avaliarConsumoForaDaFaixa(ctx),
    avaliarLitrosDesproporcionais(ctx),
  ].filter((alerta): alerta is AlertaGerado => alerta !== null);
}
