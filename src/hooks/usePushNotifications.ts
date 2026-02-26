import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const register = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const keyRes = await fetch('/api/push/vapid-public-key');
        const { publicKey } = await keyRes.json() as { publicKey: string };
        if (!publicKey) return;

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        // Recupera sessione per Authorization header
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const deviceId = getDeviceId();
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ deviceId, subscription: sub.toJSON() }),
        });

        registeredRef.current = true;
      } catch (err) {
        console.warn('Push registration failed:', err);
      }
    };

    register();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
