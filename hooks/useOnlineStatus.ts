"use client";

import { useEffect, useState } from "react";

// Começa "true" de propósito (evita mismatch de hidratação, já que o server
// não tem navigator.onLine) — se estiver realmente offline, o efeito corrige
// isso já no primeiro paint no client.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
