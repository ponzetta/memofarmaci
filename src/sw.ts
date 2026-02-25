import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// Workbox: precaching e routing per funzionamento offline
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
self.skipWaiting();

// Logica notifiche programmate
let schedule: { id: string; time: string; type: string; doctor?: string }[] = [];
let timeouts: ReturnType<typeof setTimeout>[] = [];

const scheduleNotifications = () => {
  timeouts.forEach(id => clearTimeout(id));
  timeouts = [];

  const now = new Date();

  schedule.forEach(item => {
    const [hours, minutes] = item.time.split(':').map(Number);
    const itemDate = new Date();
    itemDate.setHours(hours, minutes, 0, 0);

    if (itemDate <= now) return;

    const delay = itemDate.getTime() - now.getTime();
    const timeoutId = setTimeout(() => {
      const title = item.type === 'medication' ? 'È ora di prendere la medicina!' : 'Promemoria Appuntamento';
      const body = item.type === 'medication'
        ? `Ricordati del farmaco delle ${item.time}`
        : `Hai un appuntamento con Dr. ${item.doctor} alle ${item.time}`;

      self.registration.showNotification(title, { body, icon: '/icons/icon-192x192.png' });
    }, delay);

    timeouts.push(timeoutId);
  });
};

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SET_SCHEDULE') {
    schedule = event.data.schedule;
    scheduleNotifications();
  }
});

// Gestisce le Web Push Notifications inviate dal server (funziona in background)
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json() as {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      tag?: string;
    };
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon ?? '/icons/icon-192x192.png',
        badge: data.badge ?? '/icons/icon-192x192.png',
        tag: data.tag,
        requireInteraction: true,
      }),
    );
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('💊 MemoFarmaci', { body: text }),
    );
  }
});

// Tap sulla notifica → apre/porta in primo piano l'app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    }),
  );
});
