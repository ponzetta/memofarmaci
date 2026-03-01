import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabase';

// True quando giriamo dentro la WebView nativa Android (non Capacitor)
function isAndroidWebView(): boolean {
  return !Capacitor.isNativePlatform() && !!(window as unknown as { AndroidBridge?: unknown }).AndroidBridge;
}

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

// ── Web Push (browser) ────────────────────────────────────────────────────────

async function doWebSubscribe(): Promise<void> {
  const keyRes = await fetch('/api/push/vapid-public-key');
  const { publicKey } = await keyRes.json() as { publicKey: string };
  if (!publicKey) return;

  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const existingKey = sub.options?.applicationServerKey;
    const newKey = urlBase64ToUint8Array(publicKey);
    const keysMatch = existingKey && existingKey.byteLength === newKey.byteLength &&
      new Uint8Array(existingKey as ArrayBuffer).every((b, i) => b === newKey[i]);
    if (!keysMatch) {
      await sub.unsubscribe();
      sub = null;
    }
  }
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

// ── FCM nativo (Android / iOS) ────────────────────────────────────────────────

async function doNativeSubscribe(fcmToken: string, platform: 'android' | 'ios'): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      fcmToken,
      platform,
    }),
  });
}

// ── Hook principale ───────────────────────────────────────────────────────────

export function usePushNotifications(
  _schedule?: ScheduleItem[],
  onAlarm?: (planId: string) => void,
) {
  const [permStatus, setPermStatus] = useState<NotificationPermission>('default');
  const registeredRef = useRef(false);
  const isNative = Capacitor.isNativePlatform();
  const androidWebView = isAndroidWebView();

  // ── Setup Android WebView nativo: riceve token FCM da MainActivity.kt ───────
  useEffect(() => {
    if (!androidWebView) return;

    (window as unknown as { onFcmToken?: (token: string) => void }).onFcmToken =
      async (token: string) => {
        if (registeredRef.current) return;
        registeredRef.current = true;
        await doNativeSubscribe(token, 'android').catch(err =>
          console.warn('[MF] FCM subscribe failed:', err)
        );
      };

    return () => {
      (window as unknown as { onFcmToken?: unknown }).onFcmToken = undefined;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [androidWebView]);

  // ── Setup nativo Capacitor (iOS) ─────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;

    let mounted = true;

    async function setupNative() {
      // Android 8+: crea canale con importanza alta per garantire suono e heads-up
      if (Capacitor.getPlatform() === 'android') {
        await PushNotifications.createChannel({
          id: 'memofarmaci-alarms',
          name: 'Allarmi Farmaci',
          description: 'Notifiche per la presa dei farmaci',
          importance: 5,
          sound: 'default',
          vibration: true,
          visibility: 1,
        });
      }

      const { receive } = await PushNotifications.requestPermissions();
      if (!mounted) return;

      if (receive === 'granted') {
        setPermStatus('granted');
        await PushNotifications.register();
      } else {
        setPermStatus('denied');
      }
    }

    setupNative().catch(err => console.warn('Native push setup failed:', err));

    // Token FCM ricevuto → salva su backend
    const regListener = PushNotifications.addListener('registration', async ({ value: token }) => {
      if (!registeredRef.current) {
        registeredRef.current = true;
        const platform = Capacitor.getPlatform() as 'android' | 'ios';
        await doNativeSubscribe(token, platform).catch(err => console.warn('FCM subscribe failed:', err));
      }
    });

    // Notifica ricevuta in foreground → allarme
    const receivedListener = PushNotifications.addListener('pushNotificationReceived', notification => {
      const planId = notification.data?.planId as string | undefined;
      if (planId && onAlarm) onAlarm(planId);
    });

    // Tap su notifica → allarme
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const planId = notification.data?.planId as string | undefined;
      if (planId && onAlarm) onAlarm(planId);
    });

    return () => {
      mounted = false;
      regListener.then(h => h.remove());
      receivedListener.then(h => h.remove());
      actionListener.then(h => h.remove());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative]);

  // ── Setup web (browser) — saltato se siamo nel WebView Android nativo ────────
  useEffect(() => {
    if (isNative || androidWebView) return;
    if (!('Notification' in window)) return;
    setPermStatus(Notification.permission);
    if (Notification.permission === 'granted' && !registeredRef.current) {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        doWebSubscribe()
          .then(() => { registeredRef.current = true; })
          .catch(err => console.warn('Push auto-subscribe failed:', err));
      }
    }
  }, [isNative]);

  // ── requestAndSubscribe (solo browser) ─────────────────────────────────────
  const requestAndSubscribe = useCallback(async (): Promise<NotificationPermission> => {
    if (isNative || androidWebView) {
      // Su nativo il permesso è già richiesto nell'useEffect sopra
      return permStatus;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return 'denied';
    }
    const permission = await Notification.requestPermission();
    setPermStatus(permission);
    if (permission === 'granted') {
      try {
        await doWebSubscribe();
        registeredRef.current = true;
      } catch (err) {
        console.warn('Push subscribe failed:', err);
      }
    }
    return permission;
  }, [isNative, permStatus]);

  return { permStatus, requestAndSubscribe };
}
