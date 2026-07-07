import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehDonoSistema } from "@/lib/auth/dono-sistema";
import LogoutButton from "@/components/escritorio/logout-button";
import SidebarNav from "@/components/escritorio/sidebar-nav";
import { PinProvider } from "@/components/escritorio/pin-context";

export default async function EscritorioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { count: alertasPendentes } = await supabase
    .from("alertas")
    .select("id", { count: "exact", head: true })
    .eq("resolvido", false);

  return (
    <PinProvider>
      <div className="flex min-h-screen bg-navy-950 text-slate-100">
        <aside className="flex w-64 shrink-0 flex-col border-r border-navy-800 bg-navy-900 p-5 print:hidden">
          <div className="mb-10 flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-800 to-cyan-600 text-sm font-bold text-white shadow-glow-cyan">
              LT
            </div>
            <div>
              <div className="font-title text-lg font-bold leading-tight text-white">LuckTank</div>
              <div className="text-xs text-slate-400">Controle de combustível</div>
            </div>
          </div>

          <SidebarNav alertasPendentes={alertasPendentes ?? 0} ehDonoSistema={ehDonoSistema(user.email)} />

          <div className="mt-auto border-t border-navy-800 pt-5">
            <LogoutButton />
          </div>
        </aside>
        <main className="flex-1 p-8 lg:p-10">{children}</main>
      </div>
    </PinProvider>
  );
}
