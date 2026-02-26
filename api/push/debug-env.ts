import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  // Mostra tutte le variabili d'ambiente che contengono KV, REDIS o UPSTASH
  const relevant = Object.keys(process.env)
    .filter(k => /KV|REDIS|UPSTASH|VERCEL/i.test(k))
    .reduce<Record<string, string>>((acc, k) => {
      const val = process.env[k] ?? '';
      acc[k] = val.length > 40 ? val.slice(0, 40) + '…' : val;
      return acc;
    }, {});

  res.json({ relevant, total_env_keys: Object.keys(process.env).length });
}
