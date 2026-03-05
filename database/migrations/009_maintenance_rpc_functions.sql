-- Migration 009: Maintenance RPC functions
-- Called by the worker service to replace TimescaleDB licensed policies.

-- Refresh the 1-minute rollup materialized view
CREATE OR REPLACE FUNCTION refresh_signals_1min()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY signals_1min;
END;
$$;

-- Delete raw signals older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM signals WHERE time < now() - INTERVAL '90 days';
END;
$$;
