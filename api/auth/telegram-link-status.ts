import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autorizzato' });

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return res.status(401).json({ error: 'Token non valido' });

  const type = req.query.type as 'user' | 'caregiver';

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('telegram_user_chat_id, telegram_caregiver_chat_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  const chatId = type === 'user'
    ? profile?.telegram_user_chat_id
    : profile?.telegram_caregiver_chat_id;

  return res.json({ linked: !!chatId });
}
