import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
}

// Botão do design system: alvo de toque mínimo de 48px (min-h-touch), pensado
// pro fluxo do motorista (celular, sol, uma mão) e reaproveitado no
// escritório. Primário é navy sólido (não ciano puro) — texto branco sobre
// ciano (#00D4FF) não passa em contraste AA; navy garante legibilidade em
// qualquer contexto de luz. Ciano entra como foco/destaque, nunca como
// preenchimento de texto.
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary-800 text-white hover:bg-primary-700 active:bg-primary-900 shadow-sm hover:shadow-glow-cyan",
  secondary:
    "bg-neutral-200 text-neutral-900 hover:bg-neutral-300 active:bg-neutral-400/60 border border-neutral-300",
  outline: "border-2 border-primary-700 text-primary-800 hover:bg-primary-50",
  ghost: "text-primary-800 hover:bg-primary-50",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", fullWidth, loading, className, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "min-h-touch inline-flex items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
          VARIANTS[variant],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && (
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
