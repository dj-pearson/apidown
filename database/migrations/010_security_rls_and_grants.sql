-- Migration 010: Security — RLS policies and function access control
-- Locks down all tables and functions to appropriate access levels.

-- ============================================================
-- 1. Enable RLS on ALL tables
-- ============================================================
ALTER TABLE apis ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. apis — public can read, only service_role can write
-- ============================================================
CREATE POLICY "Public read access to APIs"
  ON apis FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role full access to APIs"
  ON apis FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 3. signals — NO public access. Only service_role (ingest/worker).
-- ============================================================
CREATE POLICY "Service role full access to signals"
  ON signals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. incidents — public can read, only service_role can write
-- ============================================================
CREATE POLICY "Public read access to incidents"
  ON incidents FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role full access to incidents"
  ON incidents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. manual_reports — anon can INSERT (to submit reports),
--    only service_role can read/update/delete
-- ============================================================
CREATE POLICY "Anon can submit manual reports"
  ON manual_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access to manual_reports"
  ON manual_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 6. alert_subscriptions — anon can INSERT (subscribe),
--    can only SELECT their own row via token,
--    only service_role has full access
-- ============================================================
CREATE POLICY "Anon can create subscriptions"
  ON alert_subscriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access to alert_subscriptions"
  ON alert_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 7. alert_log — NO public access. Only service_role.
-- ============================================================
CREATE POLICY "Service role full access to alert_log"
  ON alert_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 8. Revoke public/anon execute on internal RPC functions
-- ============================================================

-- Anomaly detection functions — service_role only
REVOKE EXECUTE ON FUNCTION get_api_window(UUID, INT) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION get_api_baseline(UUID, INT) FROM anon, authenticated, public;

-- Maintenance functions — service_role only
REVOKE EXECUTE ON FUNCTION refresh_signals_1min() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION cleanup_old_signals() FROM anon, authenticated, public;

-- Grant back to service_role explicitly
GRANT EXECUTE ON FUNCTION get_api_window(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION get_api_baseline(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION refresh_signals_1min() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_signals() TO service_role;
