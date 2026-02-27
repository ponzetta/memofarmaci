-- Migration 002: aggiunge il canale 'telegram_user_reminder' per i promemoria all'orario della dose
-- Da eseguire manualmente sul progetto Supabase (SQL Editor)

ALTER TABLE alert_sent_log DROP CONSTRAINT IF EXISTS alert_sent_log_channel_check;
ALTER TABLE alert_sent_log
  ADD CONSTRAINT alert_sent_log_channel_check
  CHECK (channel IN ('push','email','telegram_user','telegram_caregiver','telegram_user_reminder'));
