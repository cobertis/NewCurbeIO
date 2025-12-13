const CACHE_NAME = 'vip-card-v1';
const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-72.png',
      image: data.image || undefined,
      tag: data.tag || undefined,
      renotify: data.renotify || false,
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      vibrate: data.silent ? undefined : [100, 50, 100],
      data: {
        url: data.url || '/',
        notificationType: data.notificationType || 'INFO',
        notificationId: data.notificationId || null,
        timestamp: Date.now()
      }
    };

    if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
      options.actions = data.actions.slice(0, 3).map(action => ({
        action: action.action || 'default',
        title: action.title || 'Open',
        icon: action.icon || undefined
      }));
    } else {
      options.actions = [
        { action: 'open', title: 'Open' },
        { action: 'close', title: 'Dismiss' }
      ];
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'VIP Card', options)
    );
  } catch (err) {
    console.error('[SW] Push parse error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close' || event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';
  const notificationId = event.notification.data?.notificationId;

  event.waitUntil(
    (async () => {
      // Track the click event if we have a notificationId
      if (notificationId) {
        try {
          await fetch(`/api/push/track?e=clicked&nid=${notificationId}`, { 
            method: 'POST',
            keepalive: true 
          });
        } catch (err) {
          console.error('[SW] Failed to track click:', err);
        }
      }

      // Open the target URL
      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.replace('/', '')))) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
  }
});
