-- Migration 003: Signals hypertable
-- Core time-series table for SDK signal data

CREATE TABLE IF NOT EXISTS signals (
  time TIMESTAMPTZ NOT NULL DEFAULT now(),
  api_id UUID REFERENCES apis(id),
  region TEXT NOT NULL DEFAULT 'unknown',
  status_code INT NOT NULL,
  duration_ms INT NOT NULL,
  is_error BOOLEAN GENERATED ALWAYS AS (status_code >= 400) STORED,
  sdk_version TEXT,
  reporter_hash TEXT
);

-- Convert to TimescaleDB hypertable (partition by time)
SELECT create_hypertable('signals', 'time', if_not_exists => TRUE);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_signals_api_time ON signals (api_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_region_time ON signals (region, time DESC);

-- Continuous aggregate: 1-minute rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS signals_1min
WITH (timescaledb.continuous) AS
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

-- Refresh policy: keep 1-min aggregate fresh
SELECT add_continuous_aggregate_policy('signals_1min',
  start_offset   => INTERVAL '10 minutes',
  end_offset     => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute',
  if_not_exists  => TRUE
);

-- Retention: drop raw signals older than 90 days
SELECT add_retention_policy('signals', INTERVAL '90 days', if_not_exists => TRUE);
