-- Migration 005: Manual reports table

CREATE TABLE IF NOT EXISTS manual_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID REFERENCES apis(id),
  reporter_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rate limit index: max 3 reports per IP per API per hour
CREATE INDEX IF NOT EXISTS idx_manual_reports_rate_limit
  ON manual_reports (api_id, reporter_ip, created_at);
