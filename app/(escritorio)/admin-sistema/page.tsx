import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehDonoSistema } from "@/lib/auth/dono-sistema";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardTitle } from "@/components/ui/card";
import CriarEmpresaForm from "@/components/escritorio/criar-empresa-form";
import ConvidarUsuarioEmpresaForm from "@/components/escritorio/convidar-usuario-empresa-form";
import CriarVeiculoEmpresaForm from "@/components/escritorio/criar-veiculo-empresa-form";
import CriarVeiculosLoteForm from "@/components/escritorio/criar-veiculos-lote-form";
import RenovacaoEmpresaEditor from "@/components/escritorio/renovacao-empresa-editor";
import { formatarDataBr } from "@/lib/formatacao";

// Painel do dono do sistema — atravessa TODAS as empresas de propósito,
// por isso usa a service role (RLS é escopado por empresa, não existe
// policy nenhuma que deveria liberar leitura cross-tenant pra um client de
// sessão comum). O gate de acesso usa o e-mail puro da sessão do Supabase
// Auth (não getUsuarioAtual()) DE PROPÓSITO: o dono do sistema não precisa
// ter uma linha em `usuarios`/pertencer a nenhuma empresa pra acessar isto
// — se dependesse de getUsuarioAtual(), alguém sem empresa nenhuma (o caso
// mais comum pro dono, que não é administrador de tenant nenhum) nunca
// conseguiria entrar aqui. Mesmo princípio do resto do app (ex.:
// onibus/novo/page.tsx bloqueia quem não é administrador): nunca confiar só
// na ausência do link no menu.
export default async function AdminSistemaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!ehDonoSistema(user.email)) {
    return (
      <div>
        <h1 className="mb-2 font-title text-2xl font-bold text-white">Administração do sistema</h1>
        <p className="text-sm font-medium text-critico-400">
          Só o dono do sistema pode acessar esta página.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();

  const { data: empresas } = await admin
    .from("empresas")
    .select("id, nome, criado_em, proxima_renovacao")
    .order("criado_em", { ascending: false });

  const idsEmpresas = (empresas ?? []).map((e) => e.id);

  const [{ data: usuariosBrutos }, { data: veiculosBrutos }] = await Promise.all([
    idsEmpresas.length
      ? admin.from("usuarios").select("empresa_id").in("empresa_id", idsEmpresas)
      : Promise.resolve({ data: [] as { empresa_id: string }[] }),
    idsEmpresas.length
      ? admin.from("veiculos").select("empresa_id").in("empresa_id", idsEmpresas)
      : Promise.resolve({ data: [] as { empresa_id: string }[] }),
  ]);

  const contarPorEmpresa = (linhas: { empresa_id: string }[]) => {
    const mapa = new Map<string, number>();
    for (const l of linhas) mapa.set(l.empresa_id, (mapa.get(l.empresa_id) ?? 0) + 1);
    return mapa;
  };

  const mapaUsuarios = contarPorEmpresa(usuariosBrutos ?? []);
  const mapaVeiculos = contarPorEmpresa(veiculosBrutos ?? []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-title text-2xl font-bold text-white">Administração do sistema</h1>
        <p className="text-sm text-slate-400">
          Cria empresas (tenants) novas e mostra todas as que já existem — visível só pro dono do
          sistema, independente da empresa em que cada um está logado.
        </p>
      </div>

      <Card variant="dark" className="max-w-2xl">
        <CardTitle variant="dark">Empresas cadastradas ({empresas?.length ?? 0})</CardTitle>
        <div className="flex flex-col gap-2 text-sm">
          {!empresas?.length && <p className="text-slate-400">Nenhuma empresa cadastrada ainda.</p>}
          {empresas?.map((e) => (
            <div
              key={e.id}
              className="flex flex-col gap-1.5 border-b border-navy-800 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium text-white">{e.nome}</div>
                <div className="text-xs text-slate-500">
                  Criada em {formatarDataBr(e.criado_em.slice(0, 10))}
                </div>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <div className="text-xs text-slate-400">
                  {mapaUsuarios.get(e.id) ?? 0} usuário(s) · {mapaVeiculos.get(e.id) ?? 0} veículo(s)
                </div>
                <RenovacaoEmpresaEditor empresaId={e.id} proximaRenovacao={e.proxima_renovacao} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="dark" className="max-w-md">
        <CardTitle variant="dark">Criar empresa nova</CardTitle>
        <CriarEmpresaForm />
      </Card>

      <Card variant="dark" className="max-w-md">
        <CardTitle variant="dark">Convidar usuário pra uma empresa</CardTitle>
        <p className="mb-4 text-sm text-slate-400">
          Adiciona um segundo (ou terceiro) usuário a uma empresa que já existe — cadastro de
          usuário saiu de dentro da própria empresa, só o LuckTank adiciona agora.
        </p>
        <ConvidarUsuarioEmpresaForm
          empresas={(empresas ?? []).map((e) => ({ id: e.id, nome: e.nome }))}
        />
      </Card>

      <Card variant="dark" className="max-w-lg">
        <CardTitle variant="dark">Cadastrar veículo pra uma empresa</CardTitle>
        <p className="mb-4 text-sm text-slate-400">
          Cadastro de veículo também saiu de dentro da própria empresa, pelo mesmo motivo.
        </p>
        <CriarVeiculoEmpresaForm
          empresas={(empresas ?? []).map((e) => ({ id: e.id, nome: e.nome }))}
        />
      </Card>

      <Card variant="dark" className="max-w-lg">
        <CardTitle variant="dark">Cadastrar vários veículos de uma vez</CardTitle>
        <p className="mb-4 text-sm text-slate-400">
          Pra onboarding de cliente novo com frota grande — cola uma lista copiada de planilha em
          vez de cadastrar um por um.
        </p>
        <CriarVeiculosLoteForm
          empresas={(empresas ?? []).map((e) => ({ id: e.id, nome: e.nome }))}
        />
      </Card>
    </div>
  );
}
