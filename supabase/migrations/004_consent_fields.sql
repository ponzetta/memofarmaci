-- ============================================================
-- MemoFarmaci - Migration 004: Consenso privacy GDPR
-- Aggiunge i campi per tracciare il consenso esplicito
-- all'uso dei dati personali e sanitari (art. 9 GDPR).
-- Eseguire in Supabase SQL Editor.
-- ============================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_data_consent_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_policy_version       TEXT DEFAULT '1.0';

COMMENT ON COLUMN user_profiles.privacy_policy_accepted_at IS
  'Timestamp in cui l''utente ha accettato la Privacy Policy (art. 6 §1b GDPR)';
COMMENT ON COLUMN user_profiles.health_data_consent_at IS
  'Timestamp del consenso esplicito al trattamento dei dati sanitari (art. 9 §2a GDPR)';
COMMENT ON COLUMN user_profiles.privacy_policy_version IS
  'Versione della Privacy Policy accettata (es. "1.0")';
