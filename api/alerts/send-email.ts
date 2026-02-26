import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { to, caregiverName, userName, medName, time } = req.body as {
    to: string;
    caregiverName: string;
    userName: string;
    medName: string;
    time: string;
  };

  if (!to || !medName || !time) {
    return res.status(400).json({ error: 'Parametri mancanti' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@memofarmaci.app';

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `⚠️ Dose mancata: ${medName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #5A5A40;">MemoFarmaci — Dose mancata</h2>
        <p>Ciao ${caregiverName},</p>
        <p>L'assistito (<strong>${userName}</strong>) non ha preso <strong>${medName}</strong> previsto per le <strong>${time}</strong>.</p>
        <p>Ti invitiamo a contattarlo per verificare la situazione.</p>
        <hr style="border-color: #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">Email inviata automaticamente da MemoFarmaci. Non rispondere a questa email.</p>
      </div>
    `,
  });

  if (error) {
    console.error('Errore invio email Resend:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.json({ ok: true });
}
