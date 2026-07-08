import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail } from "./cliente";
import { montarEmailAlertaCritico } from "./conteudo-alerta";

// URL fixa de propósito — este e-mail é só pro escritório (nunca pro
// motorista), e o LuckTank tem um único deploy real (sem staging, ver
// PROJETO.md). Não há "request" nenhum de onde derivar o host aqui (ao
// contrário de lib/url-atual.ts, usado pra convite/redirect, este disparo
// não depende de qual ambiente fez a chamada).
const URL_ALERTAS = "https://luck-tank.vercel.app/alertas";

// Dispara e-mail pro(s) administrador(es) da empresa quando pelo menos um
// alerta CRÍTICO é gerado num abastecimento. Nunca lança — mesmo invariante
// #7 do motor de validação ("alertas nunca bloqueiam"): se o Resend estiver
// fora do ar, sem RESEND_API_KEY configurada, ou a empresa não tiver
// nenhum administrador cadastrado, o abastecimento e o próprio alerta já
// foram gravados antes desta função ser chamada — uma falha aqui é só um
// e-mail a menos, nunca um registro perdido.
export async function notificarAlertaCritico(params: {
  empresaId: string;
  veiculoLabel: string;
  tiposRegraCriticos: string[];
}): Promise<void> {
  const { empresaId, veiculoLabel, tiposRegraCriticos } = params;
  if (tiposRegraCriticos.length === 0) return;

  try {
    const admin = createAdminClient();
    const { data: administradores } = await admin
      .from("usuarios")
      .select("email")
      .eq("empresa_id", empresaId)
      .eq("papel", "administrador");

    const destinatarios = (administradores ?? []).map((u) => u.email).filter(Boolean);
    if (destinatarios.length === 0) return;

    const { assunto, html } = montarEmailAlertaCritico({
      veiculoLabel,
      tiposRegra: tiposRegraCriticos,
      urlAlertas: URL_ALERTAS,
    });

    await enviarEmail({ para: destinatarios, assunto, html });
  } catch (erro) {
    console.error("Falha ao notificar alerta crítico por e-mail:", erro);
  }
}
