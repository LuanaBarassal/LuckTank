import "server-only";

// Client mínimo do Resend via fetch direto (sem SDK novo — é só um POST),
// mesmo espírito de lib/gemini/client.ts (chave só no servidor, nunca no
// bundle do client) e lib/rate-limit.ts (usa a API do provedor direto, sem
// dependência a mais só por causa de uma chamada). Domínio `luckfrotas.com.br`
// verificado no Resend (mesmo fornecedor do LuckFrota, produto irmão) —
// LuckTank manda e-mail de um endereço desse domínio mesmo não sendo o
// domínio do próprio app (ver PROJETO.md, "Login sem acesso + convite
// falhando + suspender/excluir conta").
const REMETENTE = "LuckTank <naoresponda@luckfrotas.com.br>";

export async function enviarEmail(params: {
  para: string[];
  assunto: string;
  html: string;
}): Promise<void> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: REMETENTE,
      to: params.para,
      subject: params.assunto,
      html: params.html,
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`Resend respondeu ${resposta.status}: ${corpo}`);
  }
}
