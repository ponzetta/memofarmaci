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

  const body = req.body as {
    deviceId: string;
    // FCM nativo (Android/iOS)
    fcmToken?: string;
    platform?: 'android' | 'ios';
    // Web Push (browser)
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
  };

  const { deviceId, fcmToken, platform, subscription } = body;

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId richiesto' });
  }

  let upsertData: Record<string, unknown>;

  if (fcmToken) {
    // Modalità FCM nativa
    upsertData = {
      user_id: user.id,
      device_id: deviceId,
      fcm_token: fcmToken,
      platform: platform ?? 'android',
      endpoint: null,
      p256dh: null,
      auth_key: null,
    };
  } else if (subscription?.endpoint && subscription?.keys?.p256dh && subscription?.keys?.auth) {
    // Modalità Web Push (browser)
    upsertData = {
      user_id: user.id,
      device_id: deviceId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
      platform: 'web',
      fcm_token: null,
    };
  } else {
    return res.status(400).json({ error: 'fcmToken oppure subscription completa richiesti' });
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(upsertData, { onConflict: 'user_id,device_id' });

  if (error) {
    console.error('Errore upsert push_subscriptions:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.json({ ok: true });
}
