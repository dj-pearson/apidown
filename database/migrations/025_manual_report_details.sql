-- Migration 025: Richer manual reports for the public report feed (US-165)
--
-- Adds the two fields the public feed shows next to each report — what kind of
-- failure the reporter saw, and roughly where from — plus the indexes the
-- hourly count and 24h trend need.
--
-- Privacy: reporter_ip already stores a salted SHA-256 hash, never a raw IP.
-- `region` is a two-letter country code derived from the edge, deliberately
-- coarse: no city, no ASN, nothing that narrows to a person.

ALTER TABLE manual_reports ADD COLUMN IF NOT EXISTS error_type TEXT;
ALTER TABLE manual_reports ADD COLUMN IF NOT EXISTS region TEXT;

ALTER TABLE manual_reports DROP CONSTRAINT IF EXISTS manual_reports_error_type_check;
ALTER TABLE manual_reports ADD CONSTRAINT manual_reports_error_type_check
  CHECK (error_type IS NULL OR error_type IN (
    'timeout', 'server_error', 'auth_error', 'rate_limited', 'slow', 'other'
  ));

-- Country codes only — reject anything longer than ISO 3166-1 alpha-2.
ALTER TABLE manual_reports DROP CONSTRAINT IF EXISTS manual_reports_region_check;
ALTER TABLE manual_reports ADD CONSTRAINT manual_reports_region_check
  CHECK (region IS NULL OR length(region) <= 2);

COMMENT ON COLUMN manual_reports.error_type IS
  'What the reporter saw, chosen from a fixed list. NULL for reports predating this column.';
COMMENT ON COLUMN manual_reports.region IS
  'ISO 3166-1 alpha-2 country code from the edge. Deliberately coarse for privacy.';
COMMENT ON COLUMN manual_reports.reporter_ip IS
  'Salted SHA-256 hash of the reporter IP, used only for rate limiting. Never a raw IP.';

-- Feed and trend reads are always "recent reports for one API", newest first.
CREATE INDEX IF NOT EXISTS idx_manual_reports_api_created
  ON manual_reports (api_id, created_at DESC);
