// Service worker mínimo da Fase 1: só cuida de instalabilidade (cache do app shell).
// A fila de abastecimentos offline com sincronização/idempotência é construída na Fase 5 —
// aqui não há fila, não há Background Sync, só cache-first pros assets estáticos.

const CACHE = "lucktank-v1";
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

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).catch(() => caches.match("/"))
    )
  );
});
