import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Identidade da marca (Expresso Mundial / LuckTank): navy profundo é a
        // cor estrutural (chrome do escritório, botão primário, cabeçalhos);
        // ciano é o acento de ação/foco. `primary` é o alias usado pelos
        // componentes de UI (Button/Input) nos dois contextos — motorista e
        // escritório —, então mexer aqui rebate no app inteiro. Mesma paleta
        // usada no LuckFrota (produto irmão), pra manter a família visual.
        primary: {
          50: "#eef2f8",
          100: "#d6e0ec",
          200: "#aec0da",
          300: "#8098be",
          400: "#56749e",
          500: "#3c5a80",
          600: "#22405c",
          700: "#152c42",
          800: "#0a1628", // navy DEFAULT
          900: "#070f1c",
          950: "#050b14", // navy dark
        },
        // Mesmos valores de `primary`, mas com nome literal — usado no chrome
        // escuro do escritório (sidebar, cards, bordas) pra deixar a intenção
        // clara na leitura da classe (bg-navy-900 em vez de bg-primary-900).
        navy: {
          50: "#eef2f8",
          100: "#d6e0ec",
          200: "#aec0da",
          300: "#8098be",
          400: "#56749e",
          500: "#3c5a80",
          600: "#22405c",
          700: "#152c42",
          800: "#0a1628",
          900: "#070f1c",
          950: "#050b14",
        },
        // Ciano de destaque — foco, links, estado ativo, ícones, acentos de
        // gráfico. Nunca fundo dominante de tela (ver regra de design por
        // contexto no PROJETO.md).
        cyan: {
          50: "#e5fbff",
          100: "#ccf6ff",
          200: "#99edff",
          300: "#33ddff", // light
          400: "#00d4ff", // DEFAULT
          500: "#00bfe6",
          600: "#00a8cc", // dark
          700: "#00839e",
          800: "#005166",
          900: "#00303d",
        },
        // neutros claros — fluxo do motorista (tema claro, alto contraste)
        neutral: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        // Cores semânticas de alerta — nomes batem 1:1 com `NivelAlerta` em
        // lib/validacao/regras.ts ("info" | "atencao" | "critico"), pra ficar
        // óbvio qual token usar em cada nível. `critico` é a mais saturada e
        // com mais contraste de propósito — tem que saltar aos olhos.
        info: {
          50: "#eff6ff",
          100: "#dbeafe",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        atencao: {
          50: "#fffbeb",
          100: "#fef3c7",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        critico: {
          50: "#fef2f2",
          100: "#fee2e2",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        sucesso: {
          50: "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
      },
      fontFamily: {
        // Corpo de texto (Plus Jakarta Sans) e títulos (Space Grotesk) —
        // mesma dupla tipográfica do LuckFrota, pra reforçar a família visual
        // entre os dois produtos.
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        title: ["var(--font-title)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      minHeight: {
        touch: "48px",
      },
      boxShadow: {
        "glow-cyan": "0 8px 24px -6px rgba(0, 212, 255, 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
