"use client";

// Contexto de desbloqueio por PIN — mesmo espírito do LuckFrota (digitar uma
// vez, valer pro resto da sessão), mas com uma diferença importante: aqui o
// PIN em si (não só um booleano "desbloqueado") fica guardado em memória e é
// reenviado a cada ação protegida, porque quem verifica de verdade é sempre
// o servidor (rota de export, Server Action de exclusão) — o LuckFrota só
// oculta valor no client depois de comparar um PIN em texto puro que veio
// junto do perfil, o que não é seguro o bastante pro que este projeto exige
// (nunca confiar em nada decidido só no client). Guardado só em estado React
// (nunca localStorage/cookie): some ao recarregar a página ou sair.

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { verificarPinUsuarioAtual } from "@/lib/auth/pin-actions";
import ModalPin from "./modal-pin";

interface PinContextValor {
  // `aoConfirmar` recebe o PIN de verdade — quem chama usa esse valor pra
  // mandar junto da ação protegida (header do fetch de export, argumento da
  // Server Action de exclusão), nunca confiando num "já desbloqueei antes"
  // sem reenviar o PIN pro servidor verificar de novo.
  solicitarPin: (aoConfirmar: (pin: string) => void | Promise<void>) => void;
  bloquear: () => void;
}

const PinContext = createContext<PinContextValor | null>(null);

export function usePinProtegido(): PinContextValor {
  const contexto = useContext(PinContext);
  if (!contexto) {
    throw new Error("usePinProtegido precisa ser usado dentro de <PinProvider>.");
  }
  return contexto;
}

export function PinProvider({ children }: { children: React.ReactNode }) {
  const [pinValidado, setPinValidado] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const callbackPendente = useRef<((pin: string) => void | Promise<void>) | null>(null);

  const solicitarPin = useCallback(
    (aoConfirmar: (pin: string) => void | Promise<void>) => {
      if (pinValidado) {
        aoConfirmar(pinValidado);
        return;
      }
      setErro(null);
      callbackPendente.current = aoConfirmar;
      setModalAberto(true);
    },
    [pinValidado]
  );

  const bloquear = useCallback(() => {
    setPinValidado(null);
  }, []);

  async function handleConfirmar(pinDigitado: string) {
    setVerificando(true);
    setErro(null);
    const valido = await verificarPinUsuarioAtual(pinDigitado);
    setVerificando(false);

    if (!valido) {
      setErro("PIN incorreto.");
      return;
    }

    setPinValidado(pinDigitado);
    setModalAberto(false);

    const callback = callbackPendente.current;
    callbackPendente.current = null;
    if (callback) await callback(pinDigitado);
  }

  function handleFechar() {
    setModalAberto(false);
    callbackPendente.current = null;
    setErro(null);
  }

  return (
    <PinContext.Provider value={{ solicitarPin, bloquear }}>
      {children}
      {modalAberto && (
        <ModalPin
          erro={erro}
          verificando={verificando}
          onConfirmar={handleConfirmar}
          onFechar={handleFechar}
        />
      )}
    </PinContext.Provider>
  );
}
