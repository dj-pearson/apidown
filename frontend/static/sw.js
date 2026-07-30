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

// ─── Web Push (US-156) ───
// The payload is JSON built by the sender: { title, body, url, tag }.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A malformed payload still deserves a notification — userVisibleOnly
    // subscriptions must show one or the browser may revoke the permission.
    payload = {};
  }

  const title = payload.title || 'APIdown alert';
  const options = {
    body: payload.body || 'An API you watch changed status.',
    icon: '/logo-primary.png',
    badge: '/favicon.png',
    // Same tag replaces an earlier notification instead of stacking duplicates.
    tag: payload.tag || 'apidown-status',
    data: { url: payload.url || '/' },
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Reuse an already-open APIdown tab rather than piling up new ones.
      for (const client of clients) {
        if (client.url.includes(new URL(target, self.location.origin).pathname) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.length > 0 && 'navigate' in clients[0]) {
        return clients[0].focus().then((c) => c.navigate(target));
      }
      return self.clients.openWindow(target);
    })
  );
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
