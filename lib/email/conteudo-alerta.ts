import { ROTULO_REGRA } from "../validacao/rotulos";
import { envolverEmail, botaoEmail } from "./envelope";

// Função pura (sem I/O, sem fetch) — monta assunto/corpo do e-mail de
// alerta crítico a partir de dado já resolvido. Separado de
// notificar-alerta-critico.ts (que faz a query e o envio de verdade) pelo
// mesmo motivo de lib/validacao/regras.ts: lógica de composição é
// testável isoladamente, sem precisar de rede nem banco. Visual reaproveita
// o envelope compartilhado (envelope.ts) + a mesma cor/borda vermelha usada
// no card de alerta crítico do painel real (components/escritorio/lista-alertas.tsx:
// border-l-4 vermelho + fundo levemente tingido), pra quem já usa o painel
// reconhecer o mesmo "peso visual" no e-mail.
export function montarEmailAlertaCritico(params: {
  veiculoLabel: string;
  tiposRegra: string[];
  urlAlertas: string;
}): { assunto: string; html: string } {
  const { veiculoLabel, tiposRegra, urlAlertas } = params;

  const rotulos = tiposRegra.map((tipo) => ROTULO_REGRA[tipo] ?? tipo);

  const assunto =
    tiposRegra.length === 1
      ? `🔴 Alerta crítico — ${veiculoLabel}`
      : `🔴 ${tiposRegra.length} alertas críticos — ${veiculoLabel}`;

  const itensHtml = rotulos
    .map(
      (r) =>
        `<li style="color:#0f172a;font-size:14px;line-height:1.6;">${r}</li>`
    )
    .join("");

  const corpo = `
    <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.03em;">
      Alerta crítico
    </p>
    <h1 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-family:Arial,Helvetica,sans-serif;">
      Fique de olho no veículo <strong>${veiculoLabel}</strong>
    </h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <ul style="margin:0;padding-left:18px;">${itensHtml}</ul>
        </td>
      </tr>
    </table>
    <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Isso é só um alerta — o abastecimento já foi registrado normalmente.
      Confira os detalhes no painel antes de decidir o que fazer.
    </p>
    ${botaoEmail("Ver no painel de Alertas", urlAlertas)}
  `;

  return { assunto, html: envolverEmail(corpo) };
}
