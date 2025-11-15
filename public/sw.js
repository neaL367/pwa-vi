self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icon.png',
      badge: data.badge || '/badge.png',
      vibrate: data.vibrate || [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.data?.primaryKey || '1',
        url: data.data?.url || '/',
      },
      actions: [
        {
          action: 'open',
          title: 'Open App',
        },
        {
          action: 'close',
          title: 'Close',
        },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function (event) {
  console.log('Notification click received.');
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUnowned: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Optional: Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});