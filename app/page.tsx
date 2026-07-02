import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PwaStatus from "@/components/status/pwa-status";
import CameraTeste from "@/components/motorista/camera-teste";
import { getGeminiClient } from "@/lib/gemini/client";

function checaSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const semPlaceholder = Boolean(url && anon && service) && !url?.includes("placeholder");
  return semPlaceholder;
}

function checaGemini() {
  try {
    getGeminiClient();
    return true;
  } catch {
    return false;
  }
}

function StatusItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-neutral-700">
      <span>{ok ? "✅" : "⚠️"}</span>
      <span>{label}</span>
    </li>
  );
}

export default function StatusPage() {
  const supabaseConfigurado = checaSupabase();
  const geminiConfigurado = checaGemini();

  return (
    <main className="min-h-screen bg-neutral-50 p-4 sm:p-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold text-neutral-900">LuckTank</h1>
          <p className="text-neutral-600">Fase 1 — fundação rodando.</p>
        </header>

        <Card>
          <CardTitle>Ambiente</CardTitle>
          <ul className="flex flex-col gap-2">
            <StatusItem ok label="Next.js 14 (App Router) + TypeScript + Tailwind" />
            <StatusItem
              ok={supabaseConfigurado}
              label={
                supabaseConfigurado
                  ? "Supabase configurado (URL, anon key e service role no .env.local)"
                  : "Supabase com valores placeholder — preencha .env.local com um projeto real"
              }
            />
            <StatusItem
              ok={geminiConfigurado}
              label={
                geminiConfigurado
                  ? "Gemini configurado (GEMINI_API_KEY válida)"
                  : "Gemini com GEMINI_API_KEY placeholder — gere uma chave em aistudio.google.com/apikey"
              }
            />
          </ul>
        </Card>

        <Card>
          <CardTitle>PWA</CardTitle>
          <PwaStatus />
        </Card>

        <Card>
          <CardTitle>Design system</CardTitle>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Confirmar</Button>
              <Button variant="secondary">Editar</Button>
              <Button variant="outline">Cancelar</Button>
            </div>
            <Input label="Exemplo de campo (KM atual)" placeholder="Ex: 128400" />
          </div>
        </Card>

        <Card>
          <CardTitle>Câmera</CardTitle>
          <CameraTeste />
        </Card>
      </div>
    </main>
  );
}
