// Ambria FnB — service worker (push notifications ONLY, no caching)
//
// V96: this used to also precache the app shell and NetworkFirst-cache
// pages/scripts/styles/Supabase reads for offline use. That caching layer is
// exactly what left staff unable to log in after the Supabase Auth
// migration — an old, already-installed service worker kept serving a
// pre-migration bundle indefinitely, and critically, uninstalling and
// reinstalling the PWA's home-screen icon did NOT clear it (that storage
// lives in the browser profile the icon points at, not the icon itself) —
// only an explicit "clear site data" did. Staff would rather the app
// refuse to load without internet than silently keep running stale code
// against a backend that's moved on, so there is no `fetch` listener here
// at all now: every request, hard refresh or not, always goes straight to
// the network, exactly like a page with no service worker would behave,
// except this one can still receive push notifications when the app is
// closed (the one thing that genuinely requires a service worker to exist
// at all — see push/notificationclick below).
//
// No `self.__WB_MANIFEST` reference on purpose — vite.config.js's
// `injectManifest.injectionPoint: undefined` tells vite-plugin-pwa not to
// generate or require a precache manifest at all, since nothing here reads
// one.

self.skipWaiting();
self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async function () {
      // One-time cleanup for any device that still has the OLD caching
      // service worker's Cache Storage entries sitting around — they were
      // named 'ambria-pages' / 'ambria-assets' / 'ambria-supabase-reads'.
      // This SW never writes to any cache, so deleting every existing one
      // on activate can never delete anything this version itself needs.
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      await self.clients.claim();
    })()
  );
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
