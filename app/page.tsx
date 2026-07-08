import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  WifiOff,
  ShieldAlert,
  ClipboardList,
  QrCode,
  Camera,
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  CalendarCheck,
  Sparkles,
  ArrowRight,
  MessageCircle,
  Mail,
  KeyRound,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

const WHATSAPP = "5513997700901";
const WHATSAPP_TEXTO = encodeURIComponent(
  "Olá! Vi o LuckTank e quero saber mais sobre o controle de combustível pra minha frota."
);

// Página pública em "/" — material de venda que reforça o que já foi dito
// numa conversa, não a substitui. Fica de propósito como Server Component
// puro (sem "use client" em lugar nenhum): todo o brilho visual (blobs,
// grid, cards flutuantes) é CSS/Tailwind, os ícones do lucide-react
// renderizam como SVG estático — nada disso pede JS no client, então o
// bundle da rota "/" continua leve. Mesma paleta navy/cyan do resto do
// app (não é uma marca nova); os "mockups" abaixo usam as mesmas classes
// de cor do dashboard/alertas de verdade, recriadas em HTML fixo (não são
// screenshot). Referência visual (ícones, blobs de fundo, janela de
// navegador com foto do mockup, cards flutuantes, linha conectora nos
// passos): C:\Users\User\Desktop\luckfrota\src\pages\LandingPage.jsx —
// sem copiar números/depoimentos fabricados (LuckTank tem 1 cliente
// piloto real, inventar prova social seria mentira).
export default function RootPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-navy-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-navy-800/60 bg-navy-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-800 to-cyan-600 text-sm font-bold text-white shadow-glow-cyan">
              LT
            </div>
            <span className="font-title text-lg font-bold text-white">LuckTank</span>
          </div>
          {/* Sempre manda pro login, mesmo com sessão ativa — entrar direto
              no dashboard a partir da página pública não é o comportamento
              desejado (pedido explícito do usuário). */}
          <Link
            href="/login"
            className="rounded-xl border-2 border-cyan-600 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div
            className="absolute top-40 right-0 h-96 w-96 rounded-full bg-primary-600/30 blur-3xl"
            style={{ animationDelay: "1s" }}
          />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 pb-16 pt-14 md:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300 animate-fade-in-up">
            <ShieldCheck size={14} />
            Controle de combustível e anti-fraude
          </span>
          <h1 className="max-w-2xl font-title text-3xl font-bold leading-tight text-white md:text-5xl animate-fade-in-up">
            Pare de descobrir{" "}
            <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
              fraude de combustível
            </span>{" "}
            pelo extrato do fim do mês.
          </h1>
          <p
            className="max-w-xl text-lg text-slate-300 animate-fade-in-up"
            style={{ animationDelay: "0.05s" }}
          >
            Motorista abastece pelo celular, sem senha e sem app pra instalar. Você vê o alerta na
            hora — nota duplicada, foto reaproveitada, tanque que não bate — antes que vire prejuízo
            de rotina.
          </p>
          <div className="flex flex-wrap gap-3 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <a
              href={`https://wa.me/${WHATSAPP}?text=${WHATSAPP_TEXTO}`}
              target="_blank"
              rel="noreferrer"
              className="min-h-touch inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 text-base font-semibold text-navy-950 shadow-glow-cyan transition hover:bg-cyan-400"
            >
              <MessageCircle size={18} />
              Falar no WhatsApp
            </a>
            <a
              href="#como-funciona"
              className="min-h-touch inline-flex items-center justify-center rounded-xl border-2 border-navy-700 px-6 text-base font-semibold text-slate-200 transition hover:border-cyan-600"
            >
              Ver como funciona
            </a>
          </div>
          <div
            className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-slate-400 animate-fade-in-up"
            style={{ animationDelay: "0.15s" }}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-sucesso-400" />
              Sem fidelidade forçada
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-sucesso-400" />
              Implantação e treinamento inclusos
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-sucesso-400" />
              Suporte direto com quem construiu o sistema
            </span>
          </div>
        </div>
      </section>

      {/* Mockup do dashboard — mesmas classes/cores do dashboard real, não é screenshot */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20">
        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-navy-800 bg-navy-900 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-navy-800 bg-navy-950 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-critico-500" />
                <div className="h-3 w-3 rounded-full bg-atencao-400" />
                <div className="h-3 w-3 rounded-full bg-sucesso-500" />
              </div>
              <div className="mx-4 flex-1">
                <div className="rounded-lg bg-white/5 px-4 py-1.5 text-xs text-slate-500">
                  luck-tank.vercel.app/dashboard
                </div>
              </div>
            </div>
            <div className="p-5 md:p-8">
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
              <div className="mt-4 flex h-24 items-end gap-1.5 rounded-xl border border-navy-800 bg-navy-950 p-4">
                {[40, 65, 45, 80, 55, 90, 70, 60, 85].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Cards flutuantes — decorativos, mesmas cores semânticas do painel de alertas real */}
          <div className="absolute -left-4 -bottom-6 hidden animate-float items-center gap-3 rounded-xl bg-white p-4 shadow-2xl sm:flex md:-left-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-critico-100">
              <ShieldAlert className="text-critico-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-neutral-500">Alerta disparado</p>
              <p className="text-sm font-bold text-neutral-900">Nota fiscal duplicada</p>
            </div>
          </div>
          <div
            className="absolute -right-4 -top-6 hidden animate-float items-center gap-3 rounded-xl bg-white p-4 shadow-2xl sm:flex md:-right-8"
            style={{ animationDelay: "1.2s" }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sucesso-100">
              <WifiOff className="text-sucesso-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-neutral-500">Registrado sem sinal</p>
              <p className="text-sm font-bold text-neutral-900">Sincronizado sozinho</p>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          <ValueCard
            icon={Smartphone}
            titulo="Motorista sem senha, sem app"
            texto="Escaneia o QR fixado no painel, escolhe o nome na lista e tira uma foto do comprovante. Não precisa instalar nada nem lembrar senha nenhuma."
          />
          <ValueCard
            icon={WifiOff}
            titulo="Funciona sem internet"
            texto="Sem sinal na estrada? O registro fica salvo no celular e é enviado sozinho assim que a conexão voltar — o motorista nem percebe a diferença."
          />
          <ValueCard
            icon={ShieldAlert}
            titulo="Fraude pega sozinha"
            texto="Nota fiscal duplicada, foto de comprovante reaproveitada, tanque que não bate com a capacidade do veículo — o sistema aponta antes de virar rotina."
          />
          <ValueCard
            icon={ClipboardList}
            titulo="Toda edição fica registrada"
            texto="Quem mudou o quê e quando — uma trilha de auditoria de verdade, não só a palavra de alguém."
          />
        </div>
      </section>

      {/* Alerta mockup */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-2xl border border-navy-800 bg-navy-900 p-5 shadow-sm md:p-8">
          <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <ShieldAlert size={14} />
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

      {/* Argumento de ROI */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-2xl border border-navy-800 bg-navy-900 p-6 md:p-8">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <TrendingUp size={14} />
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
      <section id="como-funciona" className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-10 font-title text-2xl font-bold text-white md:text-3xl">Como funciona</h2>
        <div className="relative grid gap-8 md:grid-cols-3">
          <div className="absolute left-1/2 top-8 hidden h-0.5 w-2/3 -translate-x-1/2 bg-gradient-to-r from-cyan-500/10 via-cyan-400/50 to-cyan-500/10 md:block" />
          <PassoCard numero="1" icon={QrCode} titulo="Escaneia o QR" texto="Um QR fixo por veículo, colado no painel. Sem login, sem cadastro do motorista." />
          <PassoCard numero="2" icon={Camera} titulo="Tira a foto" texto="A IA lê o comprovante sozinha — litros, valor, posto. Motorista só confere." />
          <PassoCard numero="3" icon={LayoutDashboard} titulo="Escritório acompanha" texto="Dashboard, agenda e alertas em tempo real, exportável em Excel e PDF quando precisar." />
        </div>
      </section>

      {/* Planos — periodicidade de pagamento, sem valor fixo (proposta é sob medida) */}
      <section id="planos" className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
            <Sparkles size={14} />
            Formas de pagamento
          </span>
          <h2 className="mt-4 font-title text-2xl font-bold text-white md:text-3xl">
            Do jeito que funciona melhor pra sua operação
          </h2>
          <p className="mt-3 text-slate-300">
            Sem taxa escondida por veículo, sem multa de cancelamento. Você escolhe a periodicidade
            — a gente monta a proposta certa pro tamanho da sua frota.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <BillingCard icon={CalendarDays} titulo="Mensal" texto="Paga mês a mês, sem contrato longo." />
          <BillingCard icon={CalendarRange} titulo="Trimestral" texto="Fecha a cada 3 meses." />
          <BillingCard icon={CalendarClock} titulo="Semestral" texto="Fecha a cada 6 meses." />
          <BillingCard icon={CalendarCheck} titulo="Anual" texto="Fecha uma vez por ano." destaque />
        </div>

        <div className="mt-8 rounded-2xl border border-cyan-700/40 bg-gradient-to-br from-navy-900 to-navy-800 p-6 shadow-glow-cyan md:p-8">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/15">
              <KeyRound className="text-cyan-300" size={24} />
            </div>
            <div>
              <h3 className="font-title text-lg font-bold text-white">
                Assim que fecharmos, sua conta já está pronta
              </h3>
              <p className="mt-1 max-w-2xl text-slate-300">
                A gente cadastra os veículos, gera os QR Codes e cria os acessos do seu escritório
                antes de você perguntar. Você só chega e usa — e ensinamos exatamente tudo que
                precisar, no seu ritmo.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`https://wa.me/${WHATSAPP}?text=${WHATSAPP_TEXTO}`}
              target="_blank"
              rel="noreferrer"
              className="min-h-touch inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 text-base font-semibold text-navy-950 transition hover:bg-cyan-400"
            >
              <MessageCircle size={18} />
              Pedir uma proposta
              <ArrowRight size={18} />
            </a>
            <a
              href="mailto:luckfrotas@gmail.com"
              className="min-h-touch inline-flex items-center justify-center gap-2 rounded-xl border-2 border-navy-700 px-6 text-base font-semibold text-slate-200 transition hover:border-cyan-600"
            >
              <Mail size={16} />
              luckfrotas@gmail.com
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-navy-800 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-sm text-slate-500 md:flex-row md:justify-between">
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

function ValueCard({
  icon: Icon,
  titulo,
  texto,
}: {
  icon: LucideIcon;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="group rounded-2xl border border-navy-800 bg-navy-900 p-6 transition hover:-translate-y-1 hover:border-cyan-700/50">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 transition group-hover:bg-cyan-500/20">
        <Icon size={22} className="text-cyan-400" />
      </div>
      <h3 className="mb-2 font-title text-lg font-bold text-white">{titulo}</h3>
      <p className="text-sm text-slate-400">{texto}</p>
    </div>
  );
}

function PassoCard({
  numero,
  icon: Icon,
  titulo,
  texto,
}: {
  numero: string;
  icon: LucideIcon;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="relative text-center">
      <div className="relative z-10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 text-xl font-bold text-navy-950 shadow-glow-cyan">
        {numero}
      </div>
      <div className="rounded-2xl border border-navy-800 bg-navy-900 p-6">
        <Icon className="mx-auto mb-3 text-cyan-400" size={32} />
        <h3 className="mb-1 font-title text-base font-bold text-white">{titulo}</h3>
        <p className="text-sm text-slate-400">{texto}</p>
      </div>
    </div>
  );
}

function BillingCard({
  icon: Icon,
  titulo,
  texto,
  destaque = false,
}: {
  icon: LucideIcon;
  titulo: string;
  texto: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-6 text-center transition hover:-translate-y-1 ${
        destaque
          ? "border-cyan-500 bg-gradient-to-b from-cyan-500/10 to-navy-900"
          : "border-navy-800 bg-navy-900 hover:border-cyan-700/50"
      }`}
    >
      {destaque && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sucesso-500 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
          Mais econômico
        </span>
      )}
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10">
        <Icon size={22} className="text-cyan-400" />
      </div>
      <h3 className="font-title text-base font-bold text-white">{titulo}</h3>
      <p className="mt-1 text-sm text-slate-400">{texto}</p>
    </div>
  );
}
