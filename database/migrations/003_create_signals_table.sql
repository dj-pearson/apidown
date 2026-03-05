-- Migration 003: Signals hypertable
-- Core time-series table for SDK signal data
-- Run this file FIRST, then run 003b and 003c separately.

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
