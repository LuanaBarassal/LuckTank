import { ROTULO_REGRA } from "../validacao/rotulos";
import { envolverEmail, botaoEmail } from "./envelope";
import { formatarMoeda, formatarDataBr } from "../formatacao";
import type { NivelAlerta, AlertaGerado } from "../validacao/regras";

const ROTULO_NIVEL: Record<NivelAlerta, string> = {
  info: "Info",
  atencao: "Atenção",
  critico: "Crítico",
};

// Mesma paleta de tailwind.config.ts (tokens info/atencao/critico) — cores
// cruas porque e-mail não tem acesso a classe Tailwind nenhuma, só
// style inline (mesmo motivo de envelope.ts).
const ESTILO_NIVEL: Record<NivelAlerta, { bg: string; borda: string; texto: string }> = {
  info: { bg: "#eff6ff", borda: "#3b82f6", texto: "#1d4ed8" },
  atencao: { bg: "#fffbeb", borda: "#f59e0b", texto: "#b45309" },
  critico: { bg: "#fef2f2", borda: "#ef4444", texto: "#b91c1c" },
};

// Só os 2 campos usados aqui (nível + tipo) — Pick evita o email precisar
// importar/montar `detalhes` (que não aparece no corpo, só no painel real).
export type AlertaResumo = Pick<AlertaGerado, "nivel" | "tipoRegra">;

function linhaAlerta(alerta: AlertaResumo): string {
  const estilo = ESTILO_NIVEL[alerta.nivel];
  const rotulo = ROTULO_REGRA[alerta.tipoRegra] ?? alerta.tipoRegra;
  return `
    <tr>
      <td style="padding:6px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:${estilo.bg};border-left:3px solid ${estilo.borda};border-radius:6px;">
          <tr>
            <td style="padding:8px 12px;">
              <span style="display:inline-block;background-color:${estilo.borda};color:#ffffff;font-size:11px;font-weight:bold;text-transform:uppercase;padding:2px 8px;border-radius:999px;margin-right:8px;">
                ${ROTULO_NIVEL[alerta.nivel]}
              </span>
              <span style="color:${estilo.texto};font-size:13px;">${rotulo}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function linhaDado(rotulo: string, valor: string): string {
  return `
    <tr>
      <td style="padding:4px 0;color:#64748b;font-size:13px;width:40%;">${rotulo}</td>
      <td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:600;">${valor}</td>
    </tr>
  `;
}

// Função PURA (sem I/O) — mesmo padrão de conteudo-alerta.ts: composição
// testável isoladamente, visual reaproveitando o mesmo envelope navy.
// Dispara pra TODO abastecimento (não só quando há alerta), diferente do
// e-mail de alerta crítico (que continua separado, só pra crítico).
export function montarEmailAbastecimentoRegistrado(params: {
  veiculoLabel: string;
  dataAbastecimento: string;
  hora: string | null;
  motoristaLabel: string;
  litros: number;
  valorTotal: number;
  valorLitro: number | null;
  postoNome: string | null;
  postoCidade: string | null;
  kmAtual: number;
  alertas: AlertaResumo[];
  urlPainel: string;
}): { assunto: string; html: string } {
  const {
    veiculoLabel,
    dataAbastecimento,
    hora,
    motoristaLabel,
    litros,
    valorTotal,
    valorLitro,
    postoNome,
    postoCidade,
    kmAtual,
    alertas,
    urlPainel,
  } = params;

  const assunto = `LuckTank · Abastecimento registrado — ${veiculoLabel}`;

  const dataFormatada = `${formatarDataBr(dataAbastecimento)}${hora ? ` às ${hora}` : ""}`;
  const posto = [postoNome, postoCidade].filter(Boolean).join(" — ") || "—";

  const linhasDados = [
    linhaDado("Data", dataFormatada),
    linhaDado("Motorista", motoristaLabel),
    linhaDado("Litros", `${litros} L`),
    linhaDado("Valor total", formatarMoeda(valorTotal)),
    valorLitro != null ? linhaDado("Valor por litro", formatarMoeda(valorLitro)) : "",
    linhaDado("Posto", posto),
    linhaDado("KM", String(kmAtual)),
  ].join("");

  const temCritico = alertas.some((a) => a.nivel === "critico");

  const blocoAlertas =
    alertas.length > 0
      ? `
        <p style="margin:24px 0 8px;color:#64748b;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.03em;">
          ${alertas.length === 1 ? "1 alerta" : `${alertas.length} alertas`}
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${alertas.map(linhaAlerta).join("")}</table>
        ${
          temCritico
            ? `<p style="margin:12px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
                🔴 Este abastecimento tem alerta crítico — um e-mail separado, com mais destaque, também foi enviado aos administradores da empresa.
              </p>`
            : ""
        }
      `
      : "";

  const corpo = `
    <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.03em;">
      Abastecimento registrado
    </p>
    <h1 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-family:Arial,Helvetica,sans-serif;">
      ${veiculoLabel}
    </h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhasDados}</table>
    ${blocoAlertas}
    <div style="margin-top:24px;">
      ${botaoEmail(alertas.length > 0 ? "Ver painel de Alertas" : "Ver no LuckTank", alertas.length > 0 ? `${urlPainel}/alertas` : `${urlPainel}/dashboard`)}
    </div>
  `;

  return { assunto, html: envolverEmail(corpo) };
}
