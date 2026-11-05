/* Only public offline assets enter Cache Storage. Private data always uses the network. */
const CACHE_PREFIX = "thoidai-offline-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const OFFLINE_URL = "/offline.html";
const ASSETS = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin
    || url.pathname === "/api" || url.pathname.startsWith("/api/")
    || url.pathname === "/uploads" || url.pathname.startsWith("/uploads/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE_NAME)).match(OFFLINE_URL)));
  } else if (ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => (await cache.match(url.pathname)) || fetch(request)));
  }
});

function notificationUrl(value) {
  try {
    const url = new URL(value || '/my-tasks', self.location.origin);
    if (url.origin === self.location.origin && (/^\/(tasks|projects)\/[A-Za-z0-9_-]+$/.test(url.pathname) || url.pathname === '/my-tasks')) return url.href;
  } catch { /* Invalid payloads open the authenticated task list. */ }
  return new URL('/my-tasks', self.location.origin).href;
}
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Show a safe generic notification. */ }
  event.waitUntil(self.registration.showNotification('Thời Đại Work', {
    body: typeof payload.body === 'string' ? payload.body.slice(0, 500) : 'Bạn có thông báo mới.',
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag : undefined,
    data: { url: notificationUrl(payload.url) },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = notificationUrl(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      try { await existing.navigate(url); await existing.focus(); return; } catch { /* Fall back to a new window. */ }
    }
    await self.clients.openWindow(url);
  })());
});
