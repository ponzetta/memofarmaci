import type { VercelRequest, VercelResponse } from '@vercel/node';
import Redis from 'ioredis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { deviceId, schedule } = req.body as {
    deviceId: string;
    schedule: Array<{ id: string; time: string; name: string }>;
  };

  if (!deviceId) return res.status(400).json({ error: 'deviceId richiesto' });

  const redis = new Redis(process.env.REDIS_URL!);
  try {
    const raw = await redis.get(`device:${deviceId}`);
    if (!raw) return res.status(404).json({ error: 'Dispositivo non registrato' });

    const data = JSON.parse(raw) as { subscription: unknown };
    await redis.set(`device:${deviceId}`, JSON.stringify({ ...data, schedule }));
    res.json({ ok: true });
  } finally {
    redis.disconnect();
  }
}
