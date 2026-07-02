// Service worker mínimo: só cuida de instalabilidade (cache do app shell).
// A fila de abastecimentos offline com sincronização/idempotência é construída na Fase 5 —
// aqui não há fila, não há Background Sync, só cache pros assets estáticos.
//
// INCIDENTE (hardening pós-Fase 7, Fase 8 Bloco 1): a versão anterior usava
// cache-first pra TODA requisição GET, inclusive a navegação pra "/" — e o
// nome do cache nunca mudava entre deploys. Resultado: qualquer navegador
// que já tivesse instalado o SW antes de um deploy ficava preso pra sempre
// na versão antiga de "/" (viu-se isso em produção logo depois do deploy que
// trocou "/" pela tela de debug da Fase 1 pelo redirect pro /login — quem já
// tinha visitado o site continuava vendo a tela antiga). Fix: navegação
// (documento HTML) agora é network-first, com fallback pro cache só se a
// rede falhar (offline de verdade) — assets estáticos (JS/CSS com hash do
// Next) continuam cache-first, que é seguro porque o nome do arquivo muda
// a cada build.
const CACHE = "lucktank-v2";
const PRECACHE_URLS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        // offline no primeiro install, ou algum asset ainda não existe — segue sem travar
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const ehNavegacao = event.request.mode === "navigate";

  if (ehNavegacao) {
    // Documento HTML: sempre tenta a rede primeiro (pega o deploy mais
    // recente); só cai pro cache se estiver de fato offline.
    event.respondWith(
      fetch(event.request)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copia));
          return resposta;
        })
        .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("/")))
    );
    return;
  }

  // Assets estáticos (JS/CSS com hash de build, ícones, etc.): cache-first
  // é seguro aqui porque o nome do arquivo muda a cada build novo.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
