// Deprecated: il cron legge direttamente da Supabase
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({ error: 'Deprecato: lo schedule è ora gestito direttamente da Supabase' });
}
