"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onibus", label: "Ônibus" },
  { href: "/motoristas", label: "Motoristas" },
  { href: "/alertas", label: "Alertas" },
  { href: "/configuracoes", label: "Configurações" },
];

export default function SidebarNav({ alertasPendentes }: { alertasPendentes: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1.5">
      {NAV.map((item) => {
        const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium transition",
              ativo
                ? "bg-cyan-500/15 text-cyan-300"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            {item.label}
            {item.href === "/alertas" && alertasPendentes > 0 && (
              <span className="rounded-full bg-critico-500 px-2 py-0.5 text-xs font-semibold text-white">
                {alertasPendentes}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
