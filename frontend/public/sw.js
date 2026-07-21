// Service Worker for Lockscreen & System Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle background push notification events from backend or browser triggers
self.addEventListener('push', (event) => {
  let data = { title: 'Study Planner Reminder', body: 'Time for your scheduled study session!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'You have an upcoming study session!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'study-planner-reminder',
    renotify: true,
    data: {
      url: data.url || '/planner',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Codexia Study Reminder', options)
  );
});

// Handle notification click on phone lockscreen or system tray
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/planner') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/planner');
      }
    })
  );
});
