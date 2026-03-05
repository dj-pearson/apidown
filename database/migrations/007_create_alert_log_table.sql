-- Migration 007: Alert log for deduplication

CREATE TABLE IF NOT EXISTS alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id),
  subscription_id UUID REFERENCES alert_subscriptions(id),
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_log_dedup
  ON alert_log (incident_id, subscription_id);
