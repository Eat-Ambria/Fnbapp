// Ambria FnB — custom service worker (injectManifest strategy; see V92 note
// in vite.config.js for why this replaced the plain generateSW config).
// Routing/caching below reproduces exactly what the old generateSW `workbox`
// block configured — nothing about caching behavior is meant to change here,
// only the addition of the push/notificationclick handlers at the bottom.

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'ambria-pages', networkTimeoutSeconds: 3 })
);

// V82: NetworkFirst, not StaleWhileRevalidate — see vite.config.js history.
// This is content-hashed static hosting, so preferring the network whenever
// it's reachable only ever helps; the cache is purely an offline/slow-network
// fallback, never a reason a hard refresh could still see stale JS/CSS.
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new NetworkFirst({ cacheName: 'ambria-assets', networkTimeoutSeconds: 3 })
);

registerRoute(
  /ozibklsaweqizzyfwqmm\.supabase\.co\/rest\/v1\/.+\?.*select=/,
  new NetworkFirst({
    cacheName: 'ambria-supabase-reads',
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

clientsClaim();

// V81: do NOT self.skipWaiting() automatically — a freshly deployed SW must
// not silently take over an already-open tab (clientsClaim) with no reload,
// since the old JS bundle's dynamic import()s target chunk hashes the new
// deploy has already deleted. It sits "waiting" until the app's own
// "Update Now" banner (App.jsx applyPwaUpdate()) posts this message.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Web push (V92) ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  var payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {}
  var title = payload.title || 'Ambria FnB';
  var options = {
    body: payload.body || '',
    icon: '/Fnbapp/icons/icon-192x192.png',
    badge: '/Fnbapp/icons/icon-192x192.png',
    // One notification per kitchen event replaces the last rather than
    // stacking — a chef doesn't need five separate "FP changed" toasts for
    // the same function, just the latest.
    tag: payload.event_id ? ('ambria-' + payload.kind + '-' + payload.event_id) : undefined,
    data: { event_id: payload.event_id || null, kind: payload.kind || null, notification_id: payload.notification_id || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  var url = '/Fnbapp/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if ('focus' in clientList[i]) return clientList[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
