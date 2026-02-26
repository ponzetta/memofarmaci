import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Valida JWT Supabase
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header mancante' });
  }
  const token = authHeader.slice(7);

  const supabaseAdmin = getSupabaseAdmin();
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Token non valido' });
  }

  const { deviceId, subscription } = req.body as {
    deviceId: string;
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  };

  if (!deviceId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'deviceId e subscription completa richiesti' });
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        device_id: deviceId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
      },
      { onConflict: 'user_id,device_id' }
    );

  if (error) {
    console.error('Errore upsert push_subscriptions:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.json({ ok: true });
}
