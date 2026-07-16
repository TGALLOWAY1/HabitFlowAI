const CACHE_NAME = 'habitflow-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone).catch(() => undefined);
        });
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return caches.match('/index.html');
      })
  );
});

// --- Web Push habit reminders ---

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Payload missing or not JSON — fall back to a generic notification
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'HabitFlow', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: (data.data && data.data.url) || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
      if (existing) {
        return existing
          .focus()
          .then(client => (client && 'navigate' in client ? client.navigate(url) : undefined))
          .catch(() => undefined);
      }
      return self.clients.openWindow(url);
    })
  );
});

// Push services occasionally rotate subscriptions. Best-effort re-subscribe
// and re-register with the API — this only works when the API is same-origin
// (the session cookie authenticates); the reliable backstop is the
// page-load re-sync in the app itself.
self.addEventListener('pushsubscriptionchange', event => {
  const applicationServerKey =
    event.oldSubscription && event.oldSubscription.options
      ? event.oldSubscription.options.applicationServerKey
      : undefined;
  if (!applicationServerKey) return;
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey })
      .then(subscription =>
        fetch('/api/push/subscriptions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          }),
        })
      )
      .catch(() => undefined)
  );
});

