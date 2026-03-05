-- Migration 004: Incidents table

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID REFERENCES apis(id),
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  status TEXT NOT NULL DEFAULT 'investigating'
    CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  title TEXT NOT NULL,
  regions TEXT[] DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  auto_created BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_api_id ON incidents (api_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents (started_at DESC);
