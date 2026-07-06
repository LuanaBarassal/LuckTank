"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  // Conteúdo opcional sobreposto à direita do campo (ex.: botão de
  // mostrar/ocultar senha) — fica fora do fluxo do <label>, então não afeta
  // nenhum uso existente do Input que não passa essa prop.
  endAdornment?: React.ReactNode;
}

// text-base (16px) evita o zoom automático do Safari/iOS ao focar o campo.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className, endAdornment, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "min-h-touch w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100",
              endAdornment && "pr-12",
              error && "border-critico-500 focus:border-critico-500 focus:ring-critico-100",
              className
            )}
            {...props}
          />
          {endAdornment && (
            <div className="absolute inset-y-0 right-0 flex items-center">{endAdornment}</div>
          )}
        </div>
        {error && <span className="text-sm font-medium text-critico-700">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
