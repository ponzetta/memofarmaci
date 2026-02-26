-- ============================================================
-- MemoFarmaci - Schema iniziale (eseguire in Supabase SQL Editor)
-- ============================================================

-- Profilo utente (estende auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id                                       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name                               TEXT NOT NULL,
  last_name                                TEXT NOT NULL,
  phone                                    TEXT,
  email                                    TEXT,
  birth_date                               DATE,
  postal_code                              TEXT,
  caregiver_name                           TEXT,
  caregiver_phone                          TEXT,
  caregiver_email                          TEXT,
  alert_email_enabled                      BOOLEAN NOT NULL DEFAULT false,
  alert_telegram_user_enabled              BOOLEAN NOT NULL DEFAULT false,
  alert_telegram_caregiver_enabled         BOOLEAN NOT NULL DEFAULT false,
  telegram_user_chat_id                    TEXT,
  telegram_caregiver_chat_id               TEXT,
  telegram_link_token                      TEXT,
  telegram_link_token_expires_at           TIMESTAMPTZ,
  telegram_caregiver_link_token            TEXT,
  telegram_caregiver_link_token_expires_at TIMESTAMPTZ,
  missed_dose_alert_hours                  INTEGER NOT NULL DEFAULT 2,
  profile_completed                        BOOLEAN NOT NULL DEFAULT false,
  created_at                               TIMESTAMPTZ DEFAULT NOW(),
  updated_at                               TIMESTAMPTZ DEFAULT NOW()
);

-- Farmaci
CREATE TABLE IF NOT EXISTS medications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  box_photo_path  TEXT,
  pill_photo_path TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Piani terapeutici
CREATE TABLE IF NOT EXISTS medication_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  time          TEXT NOT NULL,
  dosage        TEXT NOT NULL,
  frequency     TEXT NOT NULL CHECK (frequency IN ('daily','alternate')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Log assunzioni (UNIQUE evita doppioni per stessa dose/giorno)
CREATE TABLE IF NOT EXISTS intake_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id       UUID NOT NULL REFERENCES medication_plans(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  schedule_time TEXT NOT NULL,
  schedule_date DATE NOT NULL,
  taken_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, schedule_date, schedule_time)
);

-- Effetti collaterali
CREATE TABLE IF NOT EXISTS side_effects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Appuntamenti
CREATE TABLE IF NOT EXISTS appointments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor     TEXT NOT NULL,
  location   TEXT NOT NULL,
  date_time  TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Web Push subscriptions (sostituisce Redis)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id  TEXT NOT NULL,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth_key   TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Deduplication alert mancata assunzione
CREATE TABLE IF NOT EXISTS alert_sent_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id       UUID NOT NULL,
  schedule_date DATE NOT NULL,
  schedule_time TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('push','email','telegram_user','telegram_caregiver')),
  sent_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, schedule_date, schedule_time, channel)
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE side_effects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_sent_log      ENABLE ROW LEVEL SECURITY;

-- user_profiles: ogni utente accede solo ai propri dati
CREATE POLICY "user_profiles_self" ON user_profiles
  FOR ALL USING (auth.uid() = id);

-- medications
CREATE POLICY "medications_owner" ON medications
  FOR ALL USING (auth.uid() = user_id);

-- medication_plans
CREATE POLICY "medication_plans_owner" ON medication_plans
  FOR ALL USING (auth.uid() = user_id);

-- intake_logs
CREATE POLICY "intake_logs_owner" ON intake_logs
  FOR ALL USING (auth.uid() = user_id);

-- side_effects
CREATE POLICY "side_effects_owner" ON side_effects
  FOR ALL USING (auth.uid() = user_id);

-- appointments
CREATE POLICY "appointments_owner" ON appointments
  FOR ALL USING (auth.uid() = user_id);

-- push_subscriptions: accesso client (l'utente gestisce i propri dispositivi)
CREATE POLICY "push_subscriptions_owner" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- alert_sent_log: nessun accesso client, solo service_role lato server
CREATE POLICY "alert_sent_log_no_client" ON alert_sent_log
  FOR ALL USING (false);

-- ============================================================
-- Funzione: aggiorna updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- Storage: bucket medication-photos
-- Eseguire separatamente nel dashboard Supabase → Storage:
--   1. Crea bucket "medication-photos" (privato, non public)
--   2. Policy INSERT/SELECT: auth.uid()::text = (storage.foldername(name))[1]
-- Oppure tramite SQL:
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('medication-photos', 'medication-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: l'utente può leggere solo la propria cartella {user_id}/
CREATE POLICY "medication_photos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'medication-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: l'utente può inserire solo nella propria cartella
CREATE POLICY "medication_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'medication-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: l'utente può eliminare solo i propri oggetti
CREATE POLICY "medication_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'medication-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
