import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type Acao = "insert" | "update" | "delete";

// Sempre grava via service role (nunca via sessão do usuário): a trilha de
// auditoria não pode depender de uma policy de INSERT que um client
// autenticado também conseguiria acionar por conta própria — só o próprio
// servidor decide o que entra aqui, logo depois de uma mutação bem-sucedida.
export async function registrarLog(params: {
  empresaId: string;
  tabela: string;
  registroId: string;
  usuarioId: string;
  acao: Acao;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}) {
  const admin = createAdminClient();

  const { error } = await admin.from("edicoes_log").insert({
    empresa_id: params.empresaId,
    tabela: params.tabela,
    registro_id: params.registroId,
    usuario_id: params.usuarioId,
    acao: params.acao,
    // `antes`/`depois` são sempre linhas reais vindas de .select() — já são
    // JSON-serializáveis por construção, o cast é só pra casar com o tipo
    // `Json` gerado (que não modela `Record<string, unknown>` genérico).
    antes: params.antes as Json,
    depois: params.depois as Json,
  });

  if (error) {
    // Não derruba a operação principal por causa do log, mas isso precisa
    // aparecer nos logs do servidor — investigar se acontecer em produção.
    console.error("Falha ao gravar edicoes_log:", error.message);
  }
}
