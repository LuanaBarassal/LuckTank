import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/escritorio/logout-button";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onibus", label: "Ônibus" },
  { href: "/motoristas", label: "Motoristas" },
  { href: "/alertas", label: "Alertas" },
  { href: "/configuracoes", label: "Configurações" },
];

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
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="w-56 shrink-0 border-r border-slate-800 p-4 print:hidden">
        <div className="mb-8 text-lg font-semibold">LuckTank</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              {item.label}
              {item.href === "/alertas" && !!alertasPendentes && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                  {alertasPendentes}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-slate-800 pt-4">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
