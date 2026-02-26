import type { VercelRequest, VercelResponse } from '@vercel/node';

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });

  return res.ok;
}

// Endpoint HTTP (opzionale, per test manuali)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { chatId, text } = req.body as { chatId: string; text: string };
  if (!chatId || !text) return res.status(400).json({ error: 'chatId e text richiesti' });

  const ok = await sendTelegramMessage(chatId, text);
  return res.json({ ok });
}
