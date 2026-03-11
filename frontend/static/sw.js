const CACHE_NAME = 'apidown-v1';
const STATIC_ASSETS = [
  '/favicon.png',
  '/favicon.svg',
  '/logo-white.svg',
  '/logo-primary.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only cache GET requests
  if (request.method !== 'GET') return;

  // For navigation requests, always go to network (SvelteKit handles routing)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then((r) => r || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  // For static assets, try cache first then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache static assets on first fetch
        if (response.ok && (request.url.includes('/favicon') || request.url.includes('/logo'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});
