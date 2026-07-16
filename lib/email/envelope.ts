// Envelope visual compartilhado dos e-mails do LuckTank (cabeçalho navy +
// rodapé) — função PURA (só monta string, sem I/O), mesmo padrão de
// conteudo-alerta.ts. HTML de e-mail de verdade: tabela (não flexbox/grid,
// clientes de e-mail como Outlook não suportam) e estilo inline em cada
// elemento (muitos webmails removem <style> em bloco). Paleta idêntica ao
// resto do app (navy #0a1628/#152c42, ciano #00bfe6) — ver
// tailwind.config.ts.
export function envolverEmail(corpoHtml: string): string {
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background-color:#0a1628;padding:24px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:36px;height:36px;background-color:#00a8cc;border-radius:10px;text-align:center;vertical-align:middle;">
                      <span style="color:#ffffff;font-weight:bold;font-size:14px;line-height:36px;">LT</span>
                    </td>
                    <td style="padding-left:12px;">
                      <span style="color:#ffffff;font-weight:bold;font-size:18px;">LuckTank</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${corpoHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:#94a3b8;font-size:12px;">
                  © 2026 LuckTank — controle de combustível e anti-fraude pra frotas.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

// Escapa texto de origem não confiável (ex.: motorista_nome_livre/posto_nome,
// preenchidos por quem escaneia o QR sem login nenhum) antes de entrar num
// template de e-mail — sem isso, um nome como `<a href="...">clique aqui</a>`
// vira um link clicável de verdade dentro do e-mail real que chega pro
// escritório (achado de auditoria 2026-07-16: nenhum sink de HTML de e-mail
// escapava valor nenhum). Mesmo espírito do `escapeXml` de lib/qr.ts, só que
// para HTML (cobre aspas também, que XML/atributo não precisava).
export function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Botão de ação — mesmo estilo do botão primário do app (fundo ciano,
// texto navy, cantos arredondados). `display:inline-block` é necessário
// pra padding funcionar em clientes de e-mail (um <a> puro ignora padding
// em alguns webmails).
export function botaoEmail(texto: string, url: string): string {
  return `
    <a href="${url}" style="display:inline-block;background-color:#00bfe6;color:#0a1628;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none;">
      ${texto}
    </a>
  `.trim();
}
