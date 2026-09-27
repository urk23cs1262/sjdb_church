// CACHE VERSION: sjdb-v20240928-icon-update
// Changing this string forces all installed PWA clients to pick up the new SW,
// clear old caches, and re-fetch the manifest (including updated icons).
const CACHE_VERSION = 'sjdb-v20240928';

self.addEventListener('install', (event) => {
  // Skip waiting immediately so the new SW activates without delay
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Wipe ALL old caches so the browser re-fetches icons / manifest
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Notify all open tabs to reload so they see the new icon immediately
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then((clients) => {
        clients.forEach((client) => {
          // Post a message so the app can optionally show an "App updated" toast
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      })
  );
});

// Network-first strategy for navigation requests to ensure PWA clients always
// respect server-side maintenance state and pick up updated manifests / icons.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always fetch icons and manifest fresh from network
  if (
    url.pathname.startsWith('/icon-') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/favicon.png' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first for page navigations
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {
    title: "St. John de Britto Church",
    body: "New parish update received.",
    url: "/notifications"
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const notificationId = data.notificationId || (data.data && data.data.notificationId);
  const targetUrl = data.url || (notificationId ? `/notifications?notification=${notificationId}` : '/notifications');

  const options = {
    body: data.body || data.message || "New parish update received.",
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/favicon.png',
    tag: data.tag || (notificationId ? `sjdb-notif-${notificationId}` : `sjdb-${Date.now()}`),
    renotify: true,
    vibrate: [100, 50, 100],
    data: {
      url: targetUrl,
      notificationId: notificationId
    }
  };

  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "St. John de Britto Church", options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationId = event.notification.data?.notificationId;
  const targetUrl = event.notification.data?.url || (notificationId ? `/notifications?notification=${notificationId}` : '/notifications');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

