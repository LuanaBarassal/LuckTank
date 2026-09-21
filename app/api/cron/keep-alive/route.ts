import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Chamado 1x/dia pelo Vercel Cron (ver vercel.json) só pra gerar tráfego
// real de API contra o Supabase — no plano Free, um projeto sem NENHUMA
// chamada de API por ~7 dias seguidos é pausado automaticamente (login,
// dashboard, fluxo do motorista, tudo para até alguém reativar manualmente
// no painel). Uma leitura trivial (count) já conta como atividade.
//
// Autenticado pelo header que o próprio Vercel injeta quando existe uma env
// var chamada exatamente `CRON_SECRET`: `Authorization: Bearer <valor>`.
// Sem isso o endpoint ficaria público, batendo no banco pra qualquer um que
// descobrisse a URL — barato, mas sem necessidade.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("empresas").select("id").limit(1);

  return NextResponse.json({
    supabase: error ? "erro" : "ok",
    horario: new Date().toISOString(),
  });
}
