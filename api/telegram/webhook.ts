import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function sendMessage(chatId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const update = req.body as {
    message?: {
      chat: { id: number };
      text?: string;
    };
  };

  const message = update.message;
  if (!message?.text) return res.json({ ok: true });

  const chatId = String(message.chat.id);
  const text = message.text.trim().toUpperCase();

  // Comandi base
  if (text === '/START' || text.startsWith('/START ')) {
    await sendMessage(chatId, '👋 Ciao! Inviami il codice di collegamento mostrato nell\'app MemoFarmaci (es. MF-A3K9P2) per collegare questo account.');
    return res.json({ ok: true });
  }

  // Cerca token (formato MF-XXXXXX)
  if (!text.match(/^MF-[A-Z0-9]{6}$/)) {
    await sendMessage(chatId, '❓ Codice non riconosciuto. Il formato è MF-XXXXXX (es. MF-A3K9P2).');
    return res.json({ ok: true });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Cerca token utente
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id, telegram_link_token_expires_at')
    .eq('telegram_link_token', text)
    .maybeSingle();

  if (userProfile && userProfile.telegram_link_token_expires_at > now) {
    await supabase
      .from('user_profiles')
      .update({
        telegram_user_chat_id: chatId,
        telegram_link_token: null,
        telegram_link_token_expires_at: null,
      })
      .eq('id', userProfile.id);

    await sendMessage(chatId, '✅ Collegato! Riceverai notifiche di dose mancata su questo chat.');
    return res.json({ ok: true });
  }

  // Cerca token caregiver
  const { data: caregiverProfile } = await supabase
    .from('user_profiles')
    .select('id, telegram_caregiver_link_token_expires_at')
    .eq('telegram_caregiver_link_token', text)
    .maybeSingle();

  if (caregiverProfile && caregiverProfile.telegram_caregiver_link_token_expires_at > now) {
    await supabase
      .from('user_profiles')
      .update({
        telegram_caregiver_chat_id: chatId,
        telegram_caregiver_link_token: null,
        telegram_caregiver_link_token_expires_at: null,
      })
      .eq('id', caregiverProfile.id);

    await sendMessage(chatId, '✅ Collegato come caregiver! Riceverai avvisi se l\'assistito non prende i farmaci.');
    return res.json({ ok: true });
  }

  // Token non trovato o scaduto
  await sendMessage(chatId, '❌ Codice non valido o scaduto. Genera un nuovo codice dall\'app.');
  return res.json({ ok: true });
}
