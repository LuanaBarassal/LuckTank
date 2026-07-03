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

export function Card({ variant = "light", className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-2xl border p-5 shadow-sm", VARIANTS[variant], className)}
      {...props}
    />
  );
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  variant?: Variant;
}

const TITLE_VARIANTS: Record<Variant, string> = {
  light: "text-neutral-900",
  dark: "text-white",
};

export function CardTitle({ variant = "light", className, ...props }: CardTitleProps) {
  return (
    <h2 className={cn("mb-3 text-lg font-semibold", TITLE_VARIANTS[variant], className)} {...props} />
  );
}
