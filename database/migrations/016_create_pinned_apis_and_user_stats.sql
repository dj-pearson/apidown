-- Migration 016: Pinned APIs table + user-scoped stats RPC

-- Pinned APIs (My Stack)
CREATE TABLE IF NOT EXISTS pinned_apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_id UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, api_id)
);

CREATE INDEX idx_pinned_apis_user ON pinned_apis(user_id);

ALTER TABLE pinned_apis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pinned_apis_read_own" ON pinned_apis
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pinned_apis_insert_own" ON pinned_apis
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pinned_apis_delete_own" ON pinned_apis
  FOR DELETE USING (auth.uid() = user_id);

-- RPC: Get user-scoped API stats by matching reporter_hash to user's api_keys
CREATE OR REPLACE FUNCTION get_api_stats_for_user(
  p_api_id UUID,
  p_user_id UUID,
  p_minutes INT DEFAULT 60
)
RETURNS TABLE (
  total_signals   BIGINT,
  error_count     BIGINT,
  avg_duration_ms NUMERIC,
  p50_ms          DOUBLE PRECISION,
  p95_ms          DOUBLE PRECISION
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::BIGINT                              AS total_signals,
    COUNT(*) FILTER (WHERE s.is_error)::BIGINT    AS error_count,
    COALESCE(ROUND(AVG(s.duration_ms)), 0)        AS avg_duration_ms,
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.duration_ms), 0) AS p50_ms,
    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY s.duration_ms), 0) AS p95_ms
  FROM signals s
  WHERE s.api_id = p_api_id
    AND s.time > now() - make_interval(mins => p_minutes)
    AND s.reporter_hash IN (
      SELECT LEFT(ak.key_hash, 16)
      FROM api_keys ak
      WHERE ak.user_id = p_user_id AND ak.is_active = true
    );
$$;
