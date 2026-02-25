import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import webpush from 'web-push';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Protezione: solo il cron autorizzato può chiamare questo endpoint
  const secret = req.headers['x-cron-secret'] ?? req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  // Controllo variabili d'ambiente
  const missing = ['VAPID_EMAIL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']
    .filter(k => !process.env[k]);
  if (missing.length > 0) {
    return res.status(500).json({ error: 'Variabili mancanti', missing });
  }

  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  } catch (err) {
    return res.status(500).json({ error: 'VAPID setup fallito', detail: String(err) });
  }

  // Orario corrente in Italia (UTC+1 in inverno, UTC+2 in estate)
  const now = new Date();
  const itTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const currentTime = `${itTime.getHours().toString().padStart(2, '0')}:${itTime.getMinutes().toString().padStart(2, '0')}`;

  let deviceIds: string[];
  try {
    deviceIds = (await kv.smembers('devices')) as string[];
  } catch (err) {
    return res.status(500).json({ error: 'KV smembers fallito', detail: String(err) });
  }

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
        if (e.statusCode === 410) {
          await kv.del(`device:${deviceId}`);
          await kv.srem('devices', deviceId);
        }
      }
    }

    results.push({ deviceId, sent, errors });
  }

  res.json({ time: currentTime, devices: deviceIds.length, results });
}
