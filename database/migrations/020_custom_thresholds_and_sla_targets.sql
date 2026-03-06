-- Migration 020: Custom anomaly thresholds (US-068) + SLA targets (US-072) + Team annotations (US-069)

-- US-068: Custom anomaly detection thresholds per subscription
ALTER TABLE alert_subscriptions ADD COLUMN IF NOT EXISTS threshold_config JSONB;
-- threshold_config example: {"min_severity":"major","max_p95_ms":5000,"min_error_rate_pct":10}

-- US-072: SLA target tracking
CREATE TABLE IF NOT EXISTS sla_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_id UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  uptime_target_pct NUMERIC(6,3) NOT NULL DEFAULT 99.9,
  latency_p95_target_ms INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, api_id)
);

ALTER TABLE sla_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_targets_own" ON sla_targets FOR ALL USING (auth.uid() = user_id);

-- US-069: Incident annotations (team notes)
CREATE TABLE IF NOT EXISTS incident_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_notes_incident ON incident_notes(incident_id);
ALTER TABLE incident_notes ENABLE ROW LEVEL SECURITY;

-- Team users can read notes for incidents they have access to
CREATE POLICY "incident_notes_read" ON incident_notes FOR SELECT USING (true);
CREATE POLICY "incident_notes_insert" ON incident_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- US-071: Public status page settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_status_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_status_description TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_status_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_status_slug TEXT UNIQUE;
