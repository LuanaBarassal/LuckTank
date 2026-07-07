"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePinProtegido } from "./pin-context";

export default function LogoutButton() {
  const router = useRouter();
  const { bloquear } = usePinProtegido();

  async function handleLogout() {
    bloquear();
    const supabase = createClient();
    await supabase.auth.signOut();
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
