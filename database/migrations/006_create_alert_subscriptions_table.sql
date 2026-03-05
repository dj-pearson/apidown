-- Migration 006: Alert subscriptions table

CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID REFERENCES apis(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'pagerduty', 'teams', 'discord')),
  destination TEXT NOT NULL,
  token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  verified BOOLEAN DEFAULT false,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_subs_api_id ON alert_subscriptions (api_id);
CREATE INDEX IF NOT EXISTS idx_alert_subs_token ON alert_subscriptions (token);
