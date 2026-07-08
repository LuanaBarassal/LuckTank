import { ROTULO_REGRA } from "../validacao/rotulos";

// Função pura (sem I/O, sem fetch) — monta assunto/corpo do e-mail de
// alerta crítico a partir de dado já resolvido. Separado de
// notificar-alerta-critico.ts (que faz a query e o envio de verdade) pelo
// mesmo motivo de lib/validacao/regras.ts: lógica de composição é
// testável isoladamente, sem precisar de rede nem banco.
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

  const itensHtml = rotulos.map((r) => `<li>${r}</li>`).join("");

  const html = `
    <div style="font-family: sans-serif; max-width: 480px;">
      <p style="color:#dc2626; font-weight:bold; margin-bottom: 4px;">
        Alerta crítico detectado no LuckTank
      </p>
      <p style="margin-top:0;">Veículo <strong>${veiculoLabel}</strong>:</p>
      <ul>${itensHtml}</ul>
      <p>
        <a href="${urlAlertas}" style="color:#00a8cc;">Ver detalhes no painel de Alertas</a>
      </p>
    </div>
  `.trim();

  return { assunto, html };
}
