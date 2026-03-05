-- Migration 011: Incident timeline/updates table

CREATE TABLE IF NOT EXISTS incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved', 'update')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident
  ON incident_updates (incident_id, created_at);

-- RLS
ALTER TABLE incident_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incident_updates_public_read" ON incident_updates
  FOR SELECT USING (true);

CREATE POLICY "incident_updates_service_write" ON incident_updates
  FOR INSERT WITH CHECK (current_setting('role') = 'service_role');
