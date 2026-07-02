"use client";

import { useEffect, useState } from "react";

export default function PwaStatus() {
  const [suportado, setSuportado] = useState(false);
  const [registrado, setRegistrado] = useState(false);
  const emProducao = process.env.NODE_ENV === "production";

  useEffect(() => {
    const suporta = "serviceWorker" in navigator;
    setSuportado(suporta);
    if (suporta) {
      navigator.serviceWorker.getRegistration().then((reg) => setRegistrado(Boolean(reg)));
    }
  }, []);

  return (
    <ul className="flex flex-col gap-2 text-sm text-neutral-700">
      <li>✅ Manifest (/manifest.webmanifest) linkado no &lt;head&gt;</li>
      <li>{suportado ? "✅" : "⚠️"} Navegador suporta Service Worker</li>
      <li>
        {registrado ? "✅ Service worker registrado" : emProducao ? "⚠️ Service worker não registrado" : "ℹ️ Service worker só registra em produção (esperado em dev)"}
      </li>
    </ul>
  );
}
