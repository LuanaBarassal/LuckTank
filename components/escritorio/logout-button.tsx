"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth/sessao-actions";
import { usePinProtegido } from "./pin-context";

export default function LogoutButton() {
  const router = useRouter();
  const { bloquear } = usePinProtegido();

  async function handleLogout() {
    bloquear();
    await logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-400 transition hover:bg-critico-500/10 hover:text-critico-400"
    >
      Sair
    </button>
  );
}
