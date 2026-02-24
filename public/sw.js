let schedule = [];
let timeouts = [];

const scheduleNotifications = () => {
  // Cancella tutti i timeout precedenti
  timeouts.forEach(timeoutId => clearTimeout(timeoutId));
  timeouts = [];

  const now = new Date();

  schedule.forEach(item => {
    const [hours, minutes] = item.time.split(':').map(Number);
    const itemDate = new Date();
    itemDate.setHours(hours, minutes, 0, 0);

    // Se l'orario è già passato oggi, non fare nulla
    if (itemDate < now) {
      return;
    }

    const delay = itemDate.getTime() - now.getTime();

    const timeoutId = setTimeout(() => {
      let title = '';
      let body = '';

      if (item.type === 'medication') {
        title = 'È ora di prendere la medicina!';
        // Nota: Il nome del farmaco non è disponibile qui, dobbiamo semplificare il messaggio.
        body = `Ricordati del farmaco delle ${item.time}`;
      } else if (item.type === 'appointment') {
        title = 'Promemoria Appuntamento';
        body = `Hai un appuntamento con Dr. ${item.doctor} alle ${item.time}`;
      }

      self.registration.showNotification(title, {
        body: body,
        icon: '/icons/icon-192x192.png'
      });

    }, delay);

    timeouts.push(timeoutId);
  });
};

self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting(); // Forza l'attivazione del nuovo SW
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  // Prendi il controllo immediato delle pagine
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_SCHEDULE') {
    schedule = event.data.schedule;
    console.log('Service Worker received new schedule, scheduling notifications...');
    scheduleNotifications();
  }
});


