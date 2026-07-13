import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail } from "./cliente";
import { montarEmailAbastecimentoRegistrado, type AlertaResumo } from "./conteudo-abastecimento";

// URL fixa de propósito — mesmo motivo de URL_ALERTAS em
// notificar-alerta-critico.ts: não há "request" nenhum de onde derivar o
// host (este disparo nasce do fluxo do motorista, sem sessão), e o LuckTank
// só tem um deploy real.
const URL_BASE = "https://luck-tank.vercel.app";

// Dispara o e-mail de "abastecimento registrado" pra caixa configurada em
// `empresas.email_notificacao` — UM destinatário por empresa, diferente do
// e-mail de alerta crítico (que vai pra todos os `administrador`,
// notificar-alerta-critico.ts). Dispara SEMPRE (não só quando há alerta).
//
// IDEMPOTÊNCIA: esta função só é chamada uma vez por abastecimento de
// verdade — o chamador (app/api/abastecimentos/route.ts) só chega até aqui
// depois de um INSERT que teve sucesso; um reenvio com o mesmo
// `registro_uuid` (retry de rede, ou sincronização da fila offline) esbarra
// no `unique` de `registro_uuid`/`veiculo_id` ANTES disso e retorna cedo
// (ver o bloco `insertError.code === "23505"` na rota), então nunca chama
// esta função de novo pro mesmo abastecimento. `abastecimentoId` é recebido
// só pra aparecer no log de erro (rastreio), não pra controlar duplicidade —
// não existe cenário no código atual em que a mesma linha de
// `abastecimentos` chegue aqui duas vezes.
//
// Nunca lança — mesmo invariante #7 do motor de alertas ("nunca bloqueiam"):
// se o Resend estiver fora do ar, sem RESEND_API_KEY, cota do Resend
// estourada (429), ou a empresa não tiver e-mail configurado, o
// abastecimento já foi gravado antes desta função ser chamada. Uma falha
// aqui é só um e-mail a menos, nunca um dado perdido.
export async function notificarAbastecimentoRegistrado(params: {
  abastecimentoId: string;
  empresaId: string;
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
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: empresa } = await admin
      .from("empresas")
      .select("email_notificacao")
      .eq("id", params.empresaId)
      .single();

    const destinatario = empresa?.email_notificacao;
    // Empresa sem e-mail configurado ainda — não é erro, só não há pra
    // onde enviar. Silêncio total (nem console.error), diferente da falha
    // real de envio abaixo.
    if (!destinatario) return;

    const { assunto, html } = montarEmailAbastecimentoRegistrado({
      veiculoLabel: params.veiculoLabel,
      dataAbastecimento: params.dataAbastecimento,
      hora: params.hora,
      motoristaLabel: params.motoristaLabel,
      litros: params.litros,
      valorTotal: params.valorTotal,
      valorLitro: params.valorLitro,
      postoNome: params.postoNome,
      postoCidade: params.postoCidade,
      kmAtual: params.kmAtual,
      alertas: params.alertas,
      urlPainel: URL_BASE,
    });

    await enviarEmail({ para: [destinatario], assunto, html });
  } catch (erro) {
    console.error(
      `Falha ao notificar abastecimento ${params.abastecimentoId} registrado por e-mail:`,
      erro
    );
  }
}
