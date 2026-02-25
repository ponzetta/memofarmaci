import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { deviceId, subscription, schedule } = req.body as {
    deviceId: string;
    subscription: PushSubscription;
    schedule: Array<{ id: string; time: string; medicationId: string; name: string }>;
  };

  if (!deviceId || !subscription) return res.status(400).json({ error: 'deviceId e subscription richiesti' });

  await kv.set(`device:${deviceId}`, { subscription, schedule: schedule ?? [] });
  await kv.sadd('devices', deviceId);

  res.json({ ok: true });
}
