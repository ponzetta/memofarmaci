import { useEffect, useRef } from 'react';

// ID univoco per questo dispositivo, persistito in localStorage
function getDeviceId(): string {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('deviceId', id);
  }
  return id;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export interface ScheduleItem {
  id: string;
  time: string;
  name: string;
}

export function usePushNotifications(schedule: ScheduleItem[]) {
  const registeredRef = useRef(false);
  const lastScheduleRef = useRef<string>('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const register = async () => {
      try {
        // 1. Chiedi permesso notifiche
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // 2. Ottieni VAPID public key dal server
        const keyRes = await fetch('/api/push/vapid-public-key');
        const { publicKey } = await keyRes.json() as { publicKey: string };
        if (!publicKey) return;

        // 3. Ottieni/crea push subscription
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        // 4. Registra dispositivo + schedule sul server
        const deviceId = getDeviceId();
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, subscription: sub.toJSON(), schedule }),
        });

        registeredRef.current = true;
        lastScheduleRef.current = JSON.stringify(schedule);
      } catch (err) {
        console.warn('Push registration failed:', err);
      }
    };

    register();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aggiorna lo schedule sul server ogni volta che cambia
  useEffect(() => {
    if (!registeredRef.current) return;
    const serialized = JSON.stringify(schedule);
    if (serialized === lastScheduleRef.current) return;
    lastScheduleRef.current = serialized;

    const deviceId = getDeviceId();
    fetch('/api/push/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, schedule }),
    }).catch(() => {});
  }, [schedule]);
}
