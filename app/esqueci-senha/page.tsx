import EsqueciSenhaForm from "@/components/escritorio/esqueci-senha-form";

// Rota pública de propósito (ver middleware.ts) — quem esqueceu a senha,
// por definição, não tem sessão. Mesmo layout minimalista de
// /definir-senha (card único centralizado, sem o painel de marca do
// /login — é uma tela de utilidade, não a porta de entrada principal).
export default function EsqueciSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-navy-800 to-cyan-600 text-base font-bold text-white shadow-glow-cyan">
            LT
          </div>
          <span className="font-title text-xl font-bold text-navy-900">LuckTank</span>
        </div>
        <EsqueciSenhaForm />
      </div>
    </main>
  );
}
