import type { VercelRequest, VercelResponse } from '@vercel/node';
import Redis from 'ioredis';
import webpush from 'web-push';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.headers['x-cron-secret'] ?? req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  const missing = ['VAPID_EMAIL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'REDIS_URL']
    .filter(k => !process.env[k]);
  if (missing.length > 0) {
    return res.status(500).json({ error: 'Variabili mancanti', missing });
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  // Orario corrente in Italia
  const now = new Date();
  const itTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const currentTime = `${itTime.getHours().toString().padStart(2, '0')}:${itTime.getMinutes().toString().padStart(2, '0')}`;

  const redis = new Redis(process.env.REDIS_URL!);
  try {
    const deviceIds = await redis.smembers('devices');
    const results: { deviceId: string; sent: string[]; errors: string[] }[] = [];

    for (const deviceId of deviceIds) {
      const raw = await redis.get(`device:${deviceId}`);
      if (!raw) continue;

      const data = JSON.parse(raw) as {
        subscription: webpush.PushSubscription;
        schedule: Array<{ id: string; time: string; name: string }>;
      };

      if (!data.subscription || !data.schedule) continue;

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
          if (e.statusCode === 410) {
            await redis.del(`device:${deviceId}`);
            await redis.srem('devices', deviceId);
          }
        }
      }

      results.push({ deviceId, sent, errors });
    }

    res.json({ time: currentTime, devices: deviceIds.length, results });
  } finally {
    redis.disconnect();
  }
}
