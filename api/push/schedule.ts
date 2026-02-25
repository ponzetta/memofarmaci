import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { deviceId, schedule } = req.body as {
    deviceId: string;
    schedule: Array<{ id: string; time: string; medicationId: string; name: string }>;
  };

  if (!deviceId) return res.status(400).json({ error: 'deviceId richiesto' });

  const data = await kv.get<{ subscription: PushSubscription; schedule: unknown[] }>(`device:${deviceId}`);
  if (!data) return res.status(404).json({ error: 'Dispositivo non registrato' });

  await kv.set(`device:${deviceId}`, { ...data, schedule });

  res.json({ ok: true });
}
