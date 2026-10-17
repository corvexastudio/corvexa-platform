// CaptoDesk Web Push Service Worker
// Standards-compliant background push notification receiver and click router.

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Receive background push event
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    try {
      payload = { title: 'CaptoDesk Alert', body: event.data.text() };
    } catch {
      payload = { title: 'CaptoDesk Alert', body: 'You have a new notification.' };
    }
  }

  const title = payload.title || 'CaptoDesk Alert';
  const options = {
    body: payload.body || 'You have a new update.',
    icon: '/globe.svg',
    badge: '/globe.svg',
    data: {
      url: payload.url || '/client/dashboard',
      notificationId: payload.notificationId,
      timestamp: payload.timestamp || Date.now()
    },
    vibrate: [100, 50, 100],
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Handle notification click: Focus matching open tab or open window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let targetUrl = (event.notification.data && event.notification.data.url) || '/client/dashboard';

  // Strict URL Sanitization: Prevent open redirects
  if (typeof targetUrl !== 'string' || targetUrl.startsWith('//') || targetUrl.includes('://')) {
    targetUrl = '/client/dashboard';
  }
  if (!targetUrl.startsWith('/client/')) {
    targetUrl = '/client/dashboard';
  }

  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Try to focus an existing window on the exact destination
      for (const client of clientList) {
        if (client.url === absoluteUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. Try to navigate/focus an existing CaptoDesk app window
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            return client.navigate(absoluteUrl).then((c) => c.focus());
          }
          return client.focus();
        }
      }
      // 3. Open new window if none found
      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteUrl);
      }
    })
  );
});
