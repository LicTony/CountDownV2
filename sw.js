/* ── Service Worker — Baila Más! PWA ─────────────────────────────────
   Strategy:
   - Static assets (shell): Cache-first. They never change between visits
     unless the CACHE_NAME version is bumped.
   - Google Sheets CSV: Network-first with cache fallback. Serves the last
     known schedule if the user is offline.
   ──────────────────────────────────────────────────────────────────── */

const CACHE_NAME = 'bailamas-v1.3.3';

// App shell — everything needed to render the UI without network
const SHELL_URLS = [
  './',
  'index.html',
  'app.js',
  'styles.css',
  'manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/favicon.png',
  // Google Fonts — cached so the UI looks correct offline
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;700;900&family=Inter:wght@400;600&display=swap',
];

// ── Install: pre-cache the app shell ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// ── Activate: delete stale caches ─────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // take control of open tabs immediately
  );
});

// ── Fetch: serve from cache or network ────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Google Sheets CSV → network-first, fall back to last cached response
  if (url.hostname === 'docs.google.com') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone and cache the fresh response
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)) // offline: serve cached schedule
    );
    return;
  }

  // Everything else → cache-first (app shell)
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
