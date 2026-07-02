"use client";

import { useEffect } from "react";

// Registrado só em produção: em "next dev" o service worker atrapalha o hot reload
// (serve versões em cache dos arquivos que o webpack acabou de recompilar).
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // instalação do app segue funcionando sem SW, só perde o cache do app shell
    });
  }, []);

  return null;
}
