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
