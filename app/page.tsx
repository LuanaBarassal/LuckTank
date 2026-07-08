import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const WHATSAPP = "5513997700901";
const WHATSAPP_TEXTO = encodeURIComponent(
  "Olá! Vi o LuckTank e quero saber mais sobre o controle de combustível pra minha frota."
);

// Página pública em "/" — antes era só um redirect pro login (tela de
// debug da Fase 1 removida faz tempo). Agora é o material que existe pra
// mandar depois de uma conversa de venda: reforça o que já foi dito, não
// substitui a conversa. Reaproveita a mesma paleta navy/cyan do resto do
// app (não é uma marca nova) — os "mockups" abaixo (linha de stats, card
// de alerta) usam as mesmas classes de cor do dashboard/alertas de
// verdade, só recriadas em HTML fixo (não são screenshot).
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-navy-950 text-slate-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-800 to-cyan-600 text-sm font-bold text-white shadow-glow-cyan">
            LT
          </div>
          <span className="font-title text-lg font-bold text-white">LuckTank</span>
        </div>
        <Link
          href={user ? "/dashboard" : "/login"}
          className="rounded-xl border-2 border-cyan-600 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
        >
          {user ? "Ir para o Dashboard" : "Entrar"}
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-6 pb-16 pt-10 md:pt-16">
        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
          Controle de combustível e anti-fraude
        </span>
        <h1 className="max-w-2xl font-title text-3xl font-bold leading-tight text-white md:text-5xl">
          Pare de descobrir fraude de combustível pelo extrato do fim do mês.
        </h1>
        <p className="max-w-xl text-lg text-slate-300">
          Motorista abastece pelo celular, sem senha e sem app pra instalar. Você vê o alerta na
          hora — nota duplicada, foto reaproveitada, tanque que não bate — antes que vire prejuízo
          de rotina.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`https://wa.me/${WHATSAPP}?text=${WHATSAPP_TEXTO}`}
            target="_blank"
            rel="noreferrer"
            className="min-h-touch inline-flex items-center justify-center rounded-xl bg-cyan-500 px-6 text-base font-semibold text-navy-950 shadow-glow-cyan transition hover:bg-cyan-400"
          >
            Falar no WhatsApp
          </a>
          <a
            href="#preco"
            className="min-h-touch inline-flex items-center justify-center rounded-xl border-2 border-navy-700 px-6 text-base font-semibold text-slate-200 transition hover:border-cyan-600"
          >
            Ver como funciona
          </a>
        </div>
      </section>

      {/* Mockup do dashboard — mesmas classes/cores do dashboard real, não é screenshot */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-2xl border border-navy-800 bg-navy-900 p-5 shadow-sm md:p-8">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assim fica a tela do seu escritório
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Litros no período", valor: "796,4 L" },
              { label: "Valor gasto no período", valor: "R$ 4.819,79" },
              { label: "Nº de abastecimentos", valor: "9" },
              { label: "Preço médio/litro", valor: "R$ 6,05" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-navy-800 bg-navy-950 p-4">
                <div className="text-xs text-slate-400">{item.label}</div>
                <div className="mt-1 text-xl font-bold text-white md:text-2xl">{item.valor}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-5 md:grid-cols-2">
          <ValueCard
            titulo="Motorista sem senha, sem app"
            texto="Escaneia o QR fixado no painel, escolhe o nome na lista e tira uma foto do comprovante. Não precisa instalar nada nem lembrar senha nenhuma."
          />
          <ValueCard
            titulo="Funciona sem internet"
            texto="Sem sinal na estrada? O registro fica salvo no celular e é enviado sozinho assim que a conexão voltar — o motorista nem percebe a diferença."
          />
          <ValueCard
            titulo="Fraude pega sozinha"
            texto="Nota fiscal duplicada, foto de comprovante reaproveitada, tanque que não bate com a capacidade do veículo — o sistema aponta antes de virar rotina."
          />
          <ValueCard
            titulo="Toda edição fica registrada"
            texto="Quem mudou o quê e quando — uma trilha de auditoria de verdade, não só a palavra de alguém."
          />
        </div>
      </section>

      {/* Alerta mockup */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-2xl border border-navy-800 bg-navy-900 p-5 shadow-sm md:p-8">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Exemplo real de alerta capturado
          </p>
          <div className="rounded-xl border-l-4 border-l-critico-500 bg-critico-500/5 p-4">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-critico-500 px-2 py-0.5 text-[11px] font-semibold uppercase text-white">
                Crítico
              </span>
              <span className="font-semibold text-white">Nota fiscal duplicada</span>
            </div>
            <p className="text-sm text-slate-400">2201 · DEM1A01 · mesma nota usada duas vezes em dias diferentes</p>
          </div>
        </div>
      </section>

      {/* Argumento de ROI — número redondo, não promessa: liga direto ao
          exemplo de alerta acima, pra mostrar que o valor da assinatura se
          justifica sozinho com pouquíssimas fraudes detectadas por ano. */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-2xl border border-navy-800 bg-navy-900 p-6 md:p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Por que isso se paga sozinho
          </p>
          <p className="max-w-2xl text-slate-300">
            Um abastecimento médio de frota fica perto de R$ 280. Detectar só 4 fraudes desse
            tamanho ao longo do ano — uma nota reaproveitada, uma foto repetida, um tanque que não
            bate — já cobre o valor inteiro da assinatura. O sistema aponta isso sozinho, todo mês,
            sem precisar de ninguém conferindo abastecimento por abastecimento.
          </p>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="mb-6 font-title text-2xl font-bold text-white">Como funciona</h2>
        <div className="grid gap-5 md:grid-cols-3">
          <PassoCard numero="1" titulo="Escaneia o QR" texto="Um QR fixo por veículo, colado no painel. Sem login, sem cadastro do motorista." />
          <PassoCard numero="2" titulo="Tira a foto" texto="A IA lê o comprovante sozinha — litros, valor, posto. Motorista só confere." />
          <PassoCard numero="3" titulo="Escritório acompanha" texto="Dashboard, agenda e alertas em tempo real, exportável em Excel e PDF quando precisar." />
        </div>
      </section>

      {/* Preço */}
      <section id="preco" className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-2xl border border-cyan-700/40 bg-gradient-to-br from-navy-900 to-navy-800 p-8 text-center shadow-glow-cyan md:p-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Plano único</p>
          <p className="mt-2 font-title text-4xl font-bold text-white md:text-5xl">R$ 1.000/ano</p>
          <p className="mx-auto mt-3 max-w-md text-slate-300">
            Por empresa, sem limite escondido de veículo nem cobrança extra por usuário.
            Cadastro completo e treinamento inclusos — a gente configura pra você.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href={`https://wa.me/${WHATSAPP}?text=${WHATSAPP_TEXTO}`}
              target="_blank"
              rel="noreferrer"
              className="min-h-touch inline-flex items-center justify-center rounded-xl bg-cyan-500 px-6 text-base font-semibold text-navy-950 transition hover:bg-cyan-400"
            >
              Falar no WhatsApp
            </a>
            <a
              href="mailto:luckfrotas@gmail.com"
              className="min-h-touch inline-flex items-center justify-center rounded-xl border-2 border-navy-700 px-6 text-base font-semibold text-slate-200 transition hover:border-cyan-600"
            >
              luckfrotas@gmail.com
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-navy-800 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 text-sm text-slate-500 md:flex-row md:justify-between">
          <span>© 2026 LuckTank</span>
          <div className="flex gap-4">
            <Link href="/privacidade" className="hover:text-slate-300">Política de Privacidade</Link>
            <Link href="/termos" className="hover:text-slate-300">Termos de Uso</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ValueCard({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-navy-800 bg-navy-900 p-6">
      <h3 className="mb-2 font-title text-lg font-bold text-white">{titulo}</h3>
      <p className="text-sm text-slate-400">{texto}</p>
    </div>
  );
}

function PassoCard({ numero, titulo, texto }: { numero: string; titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-navy-800 bg-navy-900 p-6">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-300">
        {numero}
      </span>
      <h3 className="mb-1 mt-3 font-title text-base font-bold text-white">{titulo}</h3>
      <p className="text-sm text-slate-400">{texto}</p>
    </div>
  );
}
