"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

// text-base (16px) evita o zoom automático do Safari/iOS ao focar o campo.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "min-h-touch rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100",
            error && "border-critico-500 focus:border-critico-500 focus:ring-critico-100",
            className
          )}
          {...props}
        />
        {error && <span className="text-sm font-medium text-critico-700">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
