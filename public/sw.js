// Incrémenter ce numéro à chaque déploiement pour forcer la mise à jour
const CACHE_VERSION = "alex-v3";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const FONTS_CACHE   = "alex-fonts";

const STATIC_ASSETS = ["/", "/index.html"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== FONTS_CACHE).map(k => caches.delete(k))
      )
    ).then(() => {
      self.clients.claim();
      self.clients.matchAll().then(clients =>
        clients.forEach(client => client.postMessage({ type: "SW_UPDATED" }))
      );
    })
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Fontes : cache-first
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    e.respondWith(
      caches.open(FONTS_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => { cache.put(e.request, res.clone()); return res; });
        })
      )
    );
    return;
  }

  // Assets locaux : network-first → fallback cache offline
  if (url.hostname === self.location.hostname) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(cached => cached || caches.match("/index.html"))
        )
    );
  }
});
