import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { Card, CardTitle } from "@/components/ui/card";
import PinForm from "@/components/escritorio/pin-form";
import EmailNotificacaoForm from "@/components/escritorio/email-notificacao-form";
import { temPinDefinido } from "./actions";

export default async function ConfiguracoesPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const [{ data: usuarios }, jaTemPin, { data: empresa }] = await Promise.all([
    supabase.from("usuarios").select("id, nome, email, papel").order("nome"),
    temPinDefinido(),
    supabase.from("empresas").select("email_notificacao").eq("id", usuario.empresa_id).single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-title text-2xl font-bold text-white">Configurações</h1>

      <Card variant="dark" className="max-w-md">
        <CardTitle variant="dark">PIN de segurança</CardTitle>
        <p className="mb-4 text-sm text-slate-400">
          Seu PIN pessoal de 6 dígitos, exigido antes de exportar Excel/PDF/fotos e antes de
          excluir um abastecimento. {jaTemPin ? "Você já tem um PIN configurado." : "Você ainda não configurou um PIN — essas ações ficarão bloqueadas até configurar."}
        </p>
        <PinForm jaTemPin={jaTemPin} />
      </Card>

      <Card variant="dark" className="max-w-md">
        <CardTitle variant="dark">E-mail de notificação</CardTitle>
        <p className="mb-4 text-sm text-slate-400">
          Toda vez que um abastecimento é registrado, o LuckTank manda um resumo pra este e-mail
          (litros, valor, KM, motorista e eventuais alertas). {usuario.papel === "administrador"
            ? "Só administradores podem alterar."
            : "Só um administrador pode alterar este e-mail."}
        </p>
        <EmailNotificacaoForm
          emailAtual={empresa?.email_notificacao ?? null}
          podeEditar={usuario.papel === "administrador"}
        />
      </Card>

      <Card variant="dark" className="max-w-2xl">
        <CardTitle variant="dark">Usuários do escritório</CardTitle>
        <div className="flex flex-col gap-2 text-sm">
          {usuarios?.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between border-b border-navy-800 py-2 last:border-0"
            >
              <div>
                <div className="font-medium text-white">{u.nome}</div>
                <div className="text-slate-400">{u.email}</div>
              </div>
              <span className="rounded-full bg-navy-800 px-2 py-1 text-xs font-medium text-cyan-300">
                {u.papel}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-sm text-slate-400">
        Precisa de mais um usuário com acesso? Fale com o suporte do LuckTank — novos usuários são
        adicionados pela nossa equipe.
      </p>
    </div>
  );
}
