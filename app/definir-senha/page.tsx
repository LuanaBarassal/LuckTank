import DefinirSenhaForm from "@/components/escritorio/definir-senha-form";

// Destino do link de convite (Supabase Auth) — tanto de convidarUsuario
// (empresa já existente) quanto de criarEmpresa (dono do sistema). Rota
// pública de propósito (ver middleware.ts): o Supabase manda os tokens
// temporários no HASH da URL (#access_token=...), que só o JavaScript no
// navegador consegue ler — nunca chega ao servidor, então esta página
// precisa ser renderizada sem exigir sessão primeiro.
export default function DefinirSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-navy-800 to-cyan-600 text-base font-bold text-white shadow-glow-cyan">
            LT
          </div>
          <span className="font-title text-xl font-bold text-navy-900">LuckTank</span>
        </div>
        <DefinirSenhaForm />
      </div>
    </main>
  );
}
