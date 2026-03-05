-- Migration 008: RPC functions for anomaly detection

-- Get aggregated metrics for an API over the last N minutes
CREATE OR REPLACE FUNCTION get_api_window(
  p_api_id UUID,
  p_minutes INT DEFAULT 5
)
RETURNS TABLE (
  total_signals BIGINT,
  error_count BIGINT,
  avg_duration_ms NUMERIC,
  p50_ms DOUBLE PRECISION,
  p95_ms DOUBLE PRECISION,
  unique_reporters BIGINT,
  regions TEXT[]
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(SUM(s.total_signals), 0) AS total_signals,
    COALESCE(SUM(s.error_count), 0) AS error_count,
    COALESCE(ROUND(AVG(s.avg_duration_ms)), 0) AS avg_duration_ms,
    COALESCE(AVG(s.p50_ms), 0) AS p50_ms,
    COALESCE(AVG(s.p95_ms), 0) AS p95_ms,
    (SELECT COUNT(DISTINCT reporter_hash) FROM signals
     WHERE api_id = p_api_id AND time > now() - make_interval(mins => p_minutes)) AS unique_reporters,
    (SELECT ARRAY_AGG(DISTINCT region) FROM signals
     WHERE api_id = p_api_id AND time > now() - make_interval(mins => p_minutes)
       AND status_code >= 400) AS regions
  FROM signals_1min s
  WHERE s.api_id = p_api_id
    AND s.bucket > now() - make_interval(mins => p_minutes);
$$;

-- Get 30-day rolling baseline for an API
CREATE OR REPLACE FUNCTION get_api_baseline(
  p_api_id UUID,
  p_days INT DEFAULT 30
)
RETURNS TABLE (
  avg_error_rate DOUBLE PRECISION,
  p50_ms DOUBLE PRECISION,
  p95_ms DOUBLE PRECISION,
  avg_total_signals NUMERIC
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(SUM(s.error_count)::double precision / NULLIF(SUM(s.total_signals), 0), 0) AS avg_error_rate,
    COALESCE(AVG(s.p50_ms), 200) AS p50_ms,
    COALESCE(AVG(s.p95_ms), 500) AS p95_ms,
    COALESCE(AVG(s.total_signals), 0) AS avg_total_signals
  FROM signals_1min s
  WHERE s.api_id = p_api_id
    AND s.bucket > now() - make_interval(days => p_days)
    AND s.bucket < now() - INTERVAL '10 minutes';
$$;
