-- Migration 028: Track per-user digest sends (US-167)
--
-- The digest worker previously "prevented duplicates" by inserting a row into
-- alert_log tied to an arbitrary incident and subscription — a row it never read
-- back, so it deduplicated nothing and polluted the alert history with sends
-- that were not incident alerts.
--
-- These columns do the job properly: one period key per user, checked before
-- sending and stamped only after a successful send, so a retry inside the same
-- period is a no-op and a failed send is retried next run.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_period TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_digest_period IS
  'Period key of the last digest delivered, e.g. daily-2026-07-30 or weekly-2026-W31. Makes sends idempotent.';
COMMENT ON COLUMN users.last_digest_sent_at IS
  'Timestamp of the last successful digest delivery.';

-- The worker scans by frequency and skips anyone already sent this period.
CREATE INDEX IF NOT EXISTS idx_users_digest_dispatch
  ON users (digest_frequency, last_digest_period)
  WHERE digest_frequency <> 'none';
