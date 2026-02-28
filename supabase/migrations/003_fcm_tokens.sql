-- Migration 003: aggiunge supporto FCM token (Capacitor/Android) alla tabella push_subscriptions
-- Eseguire su Supabase SQL Editor prima del deploy

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS fcm_token TEXT,
  ADD COLUMN IF NOT EXISTS platform  TEXT CHECK (platform IN ('web', 'android', 'ios'));

ALTER TABLE push_subscriptions
  ALTER COLUMN endpoint  DROP NOT NULL,
  ALTER COLUMN p256dh    DROP NOT NULL,
  ALTER COLUMN auth_key  DROP NOT NULL;
