import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "light" | "dark";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

// `variant="light"` (padrão) é o cartão do fluxo do motorista — fundo
// branco, alto contraste, sol forte. `variant="dark"` é o cartão do
// escritório — navy escuro, combina com a sidebar. Antes cada tela do
// escritório repetia "bg-slate-900 text-slate-100" na mão (e às vezes
// esquecia, deixando cartões claros perdidos no meio de telas escuras) —
// centralizar aqui evita essa inconsistência.
const VARIANTS: Record<Variant, string> = {
  light: "border-neutral-200 bg-white text-neutral-900",
  dark: "border-navy-800 bg-navy-900 text-slate-100",
};

// `dark` (escritório) ganhou mais respiro que `light` (fluxo do motorista) de
// propósito — o motorista tem alvo de toque/legibilidade ao sol já calibrados
// (ver regra de design por contexto no PROJETO.md), não mexer no padding dele
// só porque o escritório estava apertado.
const PADDING_VARIANTS: Record<Variant, string> = {
  light: "p-5",
  dark: "p-6",
};

export function Card({ variant = "light", className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-2xl border shadow-sm", VARIANTS[variant], PADDING_VARIANTS[variant], className)}
      {...props}
    />
  );
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  variant?: Variant;
}

const TITLE_VARIANTS: Record<Variant, string> = {
  light: "text-neutral-900 mb-3",
  dark: "text-white mb-4",
};

export function CardTitle({ variant = "light", className, ...props }: CardTitleProps) {
  return (
    <h2 className={cn("text-lg font-semibold", TITLE_VARIANTS[variant], className)} {...props} />
  );
}
