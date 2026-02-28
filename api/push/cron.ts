import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import * as admin from 'firebase-admin';

// Inizializza Firebase Admin una sola volta
if (!admin.apps.length && process.env.FIREBASE_ADMIN_KEY) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_KEY)),
  });
}

function getSupabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Orario Italia (CET/CEST)
function getItalyTime(): { dateStr: string; timeStr: string; hour: number; minute: number } {
  const now = new Date();
  const it = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const dateStr = `${it.getFullYear()}-${String(it.getMonth() + 1).padStart(2, '0')}-${String(it.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(it.getHours()).padStart(2, '0')}:${String(it.getMinutes()).padStart(2, '0')}`;
  return { dateStr, timeStr, hour: it.getHours(), minute: it.getMinutes() };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.headers['x-cron-secret'] ?? req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  const missing = ['VAPID_EMAIL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    .filter(k => !process.env[k]);
  if (missing.length > 0) {
    return res.status(500).json({ error: 'Variabili mancanti', missing });
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const { dateStr: todayStr, timeStr: currentTime, hour, minute } = getItalyTime();
  const supabase = getSupabaseAdmin();
  const results: unknown[] = [];

  // ================================================================
  // COMPITO 1 — Push ripetuta ogni minuto per max 30 minuti
  // ================================================================
  // Trova piani attivi con time nell'ultima mezz'ora (non ancora assunti)
  const totalMinutes = hour * 60 + minute;
  const thirtyMinAgo = totalMinutes - 30;
  const thirtyMinAgoStr = thirtyMinAgo <= 0
    ? '00:00'
    : `${String(Math.floor(thirtyMinAgo / 60)).padStart(2, '0')}:${String(thirtyMinAgo % 60).padStart(2, '0')}`;

  const { data: duePlans } = await supabase
    .from('medication_plans')
    .select(`
      id, user_id, medication_id, time, dosage, frequency, start_date, end_date,
      medications!inner(name)
    `)
    .gte('time', thirtyMinAgoStr)
    .lte('time', currentTime)
    .lte('start_date', todayStr)
    .gte('end_date', todayStr);

  if (duePlans) {
    for (const plan of (duePlans as unknown) as Array<{
      id: string; user_id: string; medication_id: string; time: string;
      dosage: string; frequency: string; start_date: string; end_date: string;
      medications: { name: string };
    }>) {
      // Filtra alternate: conta giorni dall'inizio
      if (plan.frequency === 'alternate') {
        const start = new Date(plan.start_date);
        start.setHours(0, 0, 0, 0);
        const today = new Date(todayStr);
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
        if (diffDays % 2 !== 0) continue;
      }

      // Salta se già assunto
      const { data: takenLog } = await supabase
        .from('intake_logs')
        .select('id')
        .eq('plan_id', plan.id)
        .eq('schedule_date', todayStr)
        .eq('schedule_time', plan.time)
        .maybeSingle();
      if (takenLog) continue;

      const medName = (plan.medications as { name: string }).name;
      const minutesSince = totalMinutes - (parseInt(plan.time.split(':')[0]) * 60 + parseInt(plan.time.split(':')[1]));
      const body = minutesSince <= 0
        ? `Ricordati di prendere ${medName}`
        : `${medName} non ancora assunto (${minutesSince} min fa)`;

      // Recupera push subscriptions — indipendente da Telegram, non skippa il piano se vuoto
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth_key, fcm_token, platform, device_id')
        .eq('user_id', plan.user_id);

      for (const sub of (subs ?? []) as Array<{
        endpoint: string | null; p256dh: string | null; auth_key: string | null;
        fcm_token: string | null; platform: string | null; device_id: string;
      }>) {
        if (sub.fcm_token) {
          // ── FCM nativo (Android / iOS) ───────────────────────────────────
          try {
            await admin.messaging().send({
              token: sub.fcm_token,
              notification: { title: '💊 È ora di prendere la medicina!', body },
              data: { planId: plan.id },
              android: {
                priority: 'high',
                notification: {
                  channelId: 'memofarmaci-alarms',
                  sound: 'default',
                  defaultSound: true,
                  defaultVibrateTimings: true,
                },
              },
              apns: {
                payload: { aps: { sound: 'default', badge: 1 } },
              },
            });
            results.push({ type: 'fcm', planId: plan.id, device: sub.device_id, ok: true });
          } catch (err: unknown) {
            const e = err as { errorInfo?: { code?: string } };
            results.push({ type: 'fcm', planId: plan.id, device: sub.device_id, error: e.errorInfo?.code });
            // Rimuovi token FCM scaduto o non registrato
            if (e.errorInfo?.code === 'messaging/registration-token-not-registered') {
              await supabase.from('push_subscriptions')
                .delete()
                .eq('fcm_token', sub.fcm_token);
            }
          }
        } else if (sub.endpoint && sub.p256dh && sub.auth_key) {
          // ── Web Push (browser) ────────────────────────────────────────────
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
              JSON.stringify({
                title: '💊 È ora di prendere la medicina!',
                body,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                tag: `med-${plan.id}-${todayStr}`,
                renotify: true,
                planId: plan.id,
              }),
            );
            results.push({ type: 'push', planId: plan.id, device: sub.device_id, ok: true });
          } catch (err: unknown) {
            const e = err as { statusCode?: number };
            results.push({ type: 'push', planId: plan.id, device: sub.device_id, error: e.statusCode });
            // Rimuovi subscription scaduta
            if (e.statusCode === 410) {
              await supabase.from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint);
            }
          }
        }
      }

      // Opzione A — Messaggio Telegram all'orario della dose (una sola volta, con deduplication)
      if (process.env.TELEGRAM_BOT_TOKEN) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('telegram_user_chat_id')
          .eq('id', plan.user_id)
          .maybeSingle();

        const chatId = (userProfile as { telegram_user_chat_id: string | null } | null)?.telegram_user_chat_id;
        if (chatId) {
          const { data: alreadySent } = await supabase
            .from('alert_sent_log')
            .select('id')
            .eq('plan_id', plan.id)
            .eq('schedule_date', todayStr)
            .eq('schedule_time', plan.time)
            .eq('channel', 'telegram_user_reminder')
            .maybeSingle();

          if (!alreadySent) {
            try {
              const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `💊 *Ora dei farmaci!*\n\nÈ ora di prendere *${medName}*.\n\n[Apri MemoFarmaci](${process.env.VITE_APP_URL ?? 'https://memofarmaci-wm25.vercel.app'}/?alarm=${plan.id})`,
                  parse_mode: 'Markdown',
                }),
              });
              if (tgRes.ok) {
                await supabase.from('alert_sent_log').insert({
                  user_id: plan.user_id,
                  plan_id: plan.id,
                  schedule_date: todayStr,
                  schedule_time: plan.time,
                  channel: 'telegram_user_reminder',
                }).select();
                results.push({ type: 'telegram_user_reminder', planId: plan.id, ok: true });
              }
            } catch {}
          }
        }
      }
    }
  }

  // ================================================================
  // COMPITO 2 — Alert mancata assunzione
  // ================================================================
  // Trova profili con alert configurati
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, missed_dose_alert_hours, alert_email_enabled, alert_telegram_user_enabled, alert_telegram_caregiver_enabled, caregiver_email, caregiver_name, telegram_user_chat_id, telegram_caregiver_chat_id')
    .or('alert_email_enabled.eq.true,alert_telegram_user_enabled.eq.true,alert_telegram_caregiver_enabled.eq.true');

  if (profiles) {
    for (const profile of profiles as Array<{
      id: string; missed_dose_alert_hours: number;
      alert_email_enabled: boolean; alert_telegram_user_enabled: boolean; alert_telegram_caregiver_enabled: boolean;
      caregiver_email: string | null; caregiver_name: string | null;
      telegram_user_chat_id: string | null; telegram_caregiver_chat_id: string | null;
    }>) {
      const alertHours = profile.missed_dose_alert_hours ?? 2;
      // Calcola soglia: piani con time <= oraCorrente - alertHours
      const thresholdMinutes = hour * 60 + minute - alertHours * 60;
      if (thresholdMinutes < 0) continue; // troppo presto nella giornata

      const thresholdTime = `${String(Math.floor(thresholdMinutes / 60)).padStart(2, '0')}:${String(thresholdMinutes % 60).padStart(2, '0')}`;

      const { data: missedPlans } = await supabase
        .from('medication_plans')
        .select('id, medication_id, time, frequency, start_date, end_date, medications!inner(name)')
        .eq('user_id', profile.id)
        .lte('time', thresholdTime)
        .lte('start_date', todayStr)
        .gte('end_date', todayStr);

      if (!missedPlans) continue;

      for (const plan of (missedPlans as unknown) as Array<{
        id: string; medication_id: string; time: string;
        frequency: string; start_date: string; end_date: string;
        medications: { name: string };
      }>) {
        // Filtra alternate
        if (plan.frequency === 'alternate') {
          const start = new Date(plan.start_date); start.setHours(0, 0, 0, 0);
          const today = new Date(todayStr); today.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
          if (diffDays % 2 !== 0) continue;
        }

        // Salta se già assunto
        const { data: takenLog } = await supabase
          .from('intake_logs')
          .select('id')
          .eq('plan_id', plan.id)
          .eq('schedule_date', todayStr)
          .eq('schedule_time', plan.time)
          .maybeSingle();
        if (takenLog) continue;

        const medName = (plan.medications as { name: string }).name;

        // Recupera profilo auth per email utente
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        const userEmail = authUser.user?.email;

        // Helper deduplication
        async function shouldSend(channel: string): Promise<boolean> {
          const { data: existing } = await supabase
            .from('alert_sent_log')
            .select('id')
            .eq('plan_id', plan.id)
            .eq('schedule_date', todayStr)
            .eq('schedule_time', plan.time)
            .eq('channel', channel)
            .maybeSingle();
          return !existing;
        }

        async function markSent(channel: string): Promise<void> {
          await supabase.from('alert_sent_log').insert({
            user_id: profile.id,
            plan_id: plan.id,
            schedule_date: todayStr,
            schedule_time: plan.time,
            channel,
          }).select();
        }

        // Email caregiver
        if (profile.alert_email_enabled && profile.caregiver_email && userEmail) {
          if (await shouldSend('email')) {
            try {
              const emailRes = await fetch(`${process.env.VITE_SUPABASE_URL?.replace('.supabase.co', '') ?? ''}/api/alerts/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: profile.caregiver_email,
                  caregiverName: profile.caregiver_name ?? 'Caregiver',
                  userName: userEmail,
                  medName,
                  time: plan.time,
                }),
              });
              if (emailRes.ok) {
                await markSent('email');
                results.push({ type: 'email', planId: plan.id, ok: true });
              }
            } catch {}
          }
        }

        // Telegram utente
        if (profile.alert_telegram_user_enabled && profile.telegram_user_chat_id) {
          if (await shouldSend('telegram_user')) {
            try {
              const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: profile.telegram_user_chat_id,
                  text: `💊 *Dose mancata*\nNon hai preso *${medName}* previsto alle *${plan.time}*.\nRicordati di prendere la tua terapia!`,
                  parse_mode: 'Markdown',
                }),
              });
              if (tgRes.ok) {
                await markSent('telegram_user');
                results.push({ type: 'telegram_user', planId: plan.id, ok: true });
              }
            } catch {}
          }
        }

        // Telegram caregiver
        if (profile.alert_telegram_caregiver_enabled && profile.telegram_caregiver_chat_id) {
          if (await shouldSend('telegram_caregiver')) {
            try {
              const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: profile.telegram_caregiver_chat_id,
                  text: `⚠️ *Dose mancata*\nL'assistito non ha preso *${medName}* previsto alle *${plan.time}*.`,
                  parse_mode: 'Markdown',
                }),
              });
              if (tgRes.ok) {
                await markSent('telegram_caregiver');
                results.push({ type: 'telegram_caregiver', planId: plan.id, ok: true });
              }
            } catch {}
          }
        }
      }
    }
  }

  return res.json({ time: currentTime, date: todayStr, results });
}
