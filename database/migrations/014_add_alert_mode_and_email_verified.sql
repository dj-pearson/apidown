-- Migration 014: Add alert_mode, user_id, and email_verified to alert_subscriptions

ALTER TABLE alert_subscriptions
  ADD COLUMN IF NOT EXISTS alert_mode TEXT NOT NULL DEFAULT 'immediate' CHECK (alert_mode IN ('immediate', 'digest'));

ALTER TABLE alert_subscriptions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE alert_subscriptions
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_alert_subs_user ON alert_subscriptions (user_id);
