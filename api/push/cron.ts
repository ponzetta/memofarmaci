import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Protezione: solo il cron autorizzato può chiamare questo endpoint
  const secret = req.headers['x-cron-secret'] ?? req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  // Orario corrente in Italia (UTC+1 in inverno, UTC+2 in estate)
  const now = new Date();
  const itTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const currentTime = `${itTime.getHours().toString().padStart(2, '0')}:${itTime.getMinutes().toString().padStart(2, '0')}`;

  const deviceIds = await kv.smembers('devices') as string[];
  const results: { deviceId: string; sent: string[]; errors: string[] }[] = [];

  for (const deviceId of deviceIds) {
    const data = await kv.get<{
      subscription: webpush.PushSubscription;
      schedule: Array<{ id: string; time: string; name: string }>;
    }>(`device:${deviceId}`);

    if (!data?.subscription || !data.schedule) continue;

    const due = data.schedule.filter(item => item.time === currentTime);
    const sent: string[] = [];
    const errors: string[] = [];

    for (const item of due) {
      try {
        await webpush.sendNotification(
          data.subscription,
          JSON.stringify({
            title: '💊 È ora di prendere la medicina!',
            body: `Ricordati di prendere ${item.name} (${item.time})`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            tag: `med-${item.id}`,
          }),
        );
        sent.push(item.id);
      } catch (err: unknown) {
        const e = err as { statusCode?: number };
        errors.push(`${item.id}: ${e.statusCode ?? 'err'}`);
        // Subscription scaduta: rimuovi il dispositivo
        if (e.statusCode === 410) {
          await kv.del(`device:${deviceId}`);
          await kv.srem('devices', deviceId);
        }
      }
    }

    results.push({ deviceId, sent, errors });
  }

  res.json({ time: currentTime, results });
}
