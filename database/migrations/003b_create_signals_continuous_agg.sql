-- Migration 003b: Materialized view for 1-minute signal rollups
-- Standard PostgreSQL materialized view (no Timescale license required).
-- The worker service refreshes this view periodically.
-- Run AFTER 003_create_signals_table.sql succeeds.

CREATE MATERIALIZED VIEW IF NOT EXISTS signals_1min AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  api_id,
  region,
  COUNT(*) AS total_signals,
  SUM(is_error::int) AS error_count,
  ROUND(AVG(duration_ms)) AS avg_duration_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms
FROM signals
GROUP BY bucket, api_id, region;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_1min_unique
  ON signals_1min (bucket, api_id, region);

-- Query index
CREATE INDEX IF NOT EXISTS idx_signals_1min_api_bucket
  ON signals_1min (api_id, bucket DESC);
