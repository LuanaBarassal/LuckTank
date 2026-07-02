"use client";

import { Button } from "@/components/ui/button";

export default function BotaoImprimir() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      Imprimir etiqueta
    </Button>
  );
}
