self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first strategy for navigation requests to ensure PWA clients always respect server-side maintenance state
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {
    title: "St. John de britto Church",
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
    icon: data.icon || '/favicon.png',
    badge: data.badge || '/favicon.png',
    tag: data.tag || (notificationId ? `sjdb-notif-${notificationId}` : `sjdb-${Date.now()}`),
    renotify: true,
    vibrate: [100, 50, 100],
    data: {
      url: targetUrl,
      notificationId: notificationId
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "St. John de britto Church", options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationId = event.notification.data?.notificationId;
  const targetUrl = event.notification.data?.url || (notificationId ? `/notifications?notification=${notificationId}` : '/notifications');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, navigate it to the notification and focus
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
