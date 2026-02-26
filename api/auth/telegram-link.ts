import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = 'MF-';
  for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autorizzato' });

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return res.status(401).json({ error: 'Token non valido' });

  const { type } = req.body as { type: 'user' | 'caregiver' };
  if (type !== 'user' && type !== 'caregiver') {
    return res.status(400).json({ error: 'type deve essere "user" o "caregiver"' });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minuti

  const field = type === 'user'
    ? { telegram_link_token: token, telegram_link_token_expires_at: expiresAt }
    : { telegram_caregiver_link_token: token, telegram_caregiver_link_token_expires_at: expiresAt };

  const { error } = await supabase.from('user_profiles').update(field).eq('id', user.id);
  if (error) return res.status(500).json({ error: error.message });

  const botName = process.env.TELEGRAM_BOT_USERNAME ?? 'MemoFarmaciBot';
  return res.json({ token, expiresAt, botName });
}
