-- Migration 017: Downtime cost estimator + scheduled maintenance

-- Add cost_per_minute to pinned_apis for downtime cost estimation
ALTER TABLE pinned_apis ADD COLUMN IF NOT EXISTS cost_per_minute_cents INT DEFAULT 0;

-- Scheduled maintenances from vendor status pages
CREATE TABLE IF NOT EXISTS scheduled_maintenances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  scheduled_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(api_id, vendor_id)
);

CREATE INDEX idx_sched_maint_api ON scheduled_maintenances(api_id);
CREATE INDEX idx_sched_maint_upcoming ON scheduled_maintenances(scheduled_for)
  WHERE status IN ('scheduled', 'in_progress');

-- Add digest_frequency to users for weekly/daily digest preference
ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_frequency TEXT NOT NULL DEFAULT 'none'
  CHECK (digest_frequency IN ('none', 'weekly', 'daily'));
