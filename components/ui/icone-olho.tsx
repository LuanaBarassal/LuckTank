// Ícones mínimos desenhados à mão (sem lib de ícone no projeto) — "olho"
// (senha visível) e "olho cortado" (senha oculta), 20x20, herdam a cor via
// `currentColor` pra seguir o hover/focus do botão que os envolve. Extraído
// de login-form.tsx pra ser reaproveitado também em definir-senha-form.tsx.
export function IconeOlho({ aberto }: { aberto: boolean }) {
  if (aberto) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2.5 12s3.75-7 9.5-7 9.5 7 9.5 7-3.75 7-9.5 7-9.5-7-9.5-7Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 3.5l17 17M6.6 6.9C4.4 8.4 2.5 12 2.5 12s3.75 7 9.5 7c1.9 0 3.55-.55 4.9-1.35M10.6 10.6a3 3 0 0 0 4.24 4.24M9.9 5.2A9.7 9.7 0 0 1 12 5c5.75 0 9.5 7 9.5 7-.5.9-1.35 2.15-2.55 3.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
