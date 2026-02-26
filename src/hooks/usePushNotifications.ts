import { useState, useEffect, useRef, useCallback } from 'react';
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

async function doSubscribe(): Promise<void> {
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

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ deviceId: getDeviceId(), subscription: sub.toJSON() }),
  });
}

export function usePushNotifications(_schedule?: ScheduleItem[]) {
  const [permStatus, setPermStatus] = useState<NotificationPermission>('default');
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermStatus(Notification.permission);
    // Se il permesso è già concesso, ri-registra silenziosamente
    if (Notification.permission === 'granted' && !registeredRef.current) {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        doSubscribe()
          .then(() => { registeredRef.current = true; })
          .catch(err => console.warn('Push auto-subscribe failed:', err));
      }
    }
  }, []);

  const requestAndSubscribe = useCallback(async (): Promise<NotificationPermission> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return 'denied';
    }
    const permission = await Notification.requestPermission();
    setPermStatus(permission);
    if (permission === 'granted') {
      try {
        await doSubscribe();
        registeredRef.current = true;
      } catch (err) {
        console.warn('Push subscribe failed:', err);
      }
    }
    return permission;
  }, []);

  return { permStatus, requestAndSubscribe };
}
