-- 029: signals_1min becomes a table the worker updates incrementally.
--
-- WHY. signals_1min was a materialized view over ALL of signals, and the worker
-- refreshed it every minute with REFRESH MATERIALIZED VIEW CONCURRENTLY. With
-- 90 days of signals (16.3M rows, 4.4 GB on 2026-10-24) one refresh takes
-- 8m22s, and the worker's RPC runs as authenticator with statement_timeout=8s,
-- so every refresh was cancelled. The last successful one was 2026-03-07.
-- Since then every reader of signals_1min (home sparklines, API pages, report
-- cards, widgets, digests, the reliability score) saw nothing recent, and the
-- reliability score read the missing latency as p95 = 0 ms.
--
-- Continuous aggregates would be the TimescaleDB answer, but the Apache build
-- has none (see services/worker/src/lib/maintenance.js), so this does by hand
-- what one would: refresh_signals_1min() recomputes only the recent buckets
-- and upserts them. A minute of signals is ~110 rows, so it is well inside 8s.
--
-- The window starts 15 minutes back, or at the newest stored bucket when that
-- is older (the worker was down), so a gap closes itself on the next run. It
-- reaches back at most 1 day per run; a longer outage needs the one-off
-- backfill at the bottom of this file.
--
-- PRIVILEGES. The view granted anon and authenticated every privilege, which
-- did nothing on a view that cannot be written. Copied onto a table it would
-- let anyone holding the anon key insert or delete stats through PostgREST, so
-- the table grants SELECT only to them, under RLS.
--
-- Run as one transaction. The copy reads the existing view (current as of its
-- last refresh) instead of re-aggregating 16M signals.

BEGIN;

CREATE TABLE public.signals_1min_next (
  bucket          timestamptz      NOT NULL,
  api_id          uuid             NOT NULL,
  region          text             NOT NULL,
  total_signals   bigint           NOT NULL,
  error_count     bigint           NOT NULL,
  avg_duration_ms numeric,
  p50_ms          double precision,
  p95_ms          double precision,
  CONSTRAINT signals_1min_pkey PRIMARY KEY (bucket, api_id, region)
);

INSERT INTO public.signals_1min_next
SELECT bucket, api_id, region, total_signals, error_count, avg_duration_ms, p50_ms, p95_ms
FROM public.signals_1min;

DROP MATERIALIZED VIEW public.signals_1min;
ALTER TABLE public.signals_1min_next RENAME TO signals_1min;
CREATE INDEX idx_signals_1min_api_bucket ON public.signals_1min (api_id, bucket DESC);

REVOKE ALL ON public.signals_1min FROM anon, authenticated, public;
GRANT SELECT ON public.signals_1min TO anon, authenticated;
GRANT ALL ON public.signals_1min TO service_role;
ALTER TABLE public.signals_1min ENABLE ROW LEVEL SECURITY;
CREATE POLICY signals_1min_public_read ON public.signals_1min
  FOR SELECT TO anon, authenticated USING (true);

-- Same name and no arguments, so the worker's rpc('refresh_signals_1min') and
-- the grants from 010 carry over unchanged.
CREATE OR REPLACE FUNCTION public.refresh_signals_1min()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest timestamptz;
  v_from   timestamptz;
BEGIN
  SELECT max(bucket) INTO v_latest FROM signals_1min;
  v_from := time_bucket('1 minute', LEAST(
    now() - interval '15 minutes',
    COALESCE(v_latest, now() - interval '1 day')
  ));
  v_from := GREATEST(v_from, time_bucket('1 minute', now() - interval '1 day'));

  INSERT INTO signals_1min AS s
    (bucket, api_id, region, total_signals, error_count, avg_duration_ms, p50_ms, p95_ms)
  SELECT
    time_bucket('1 minute', time),
    api_id,
    region,
    count(*),
    sum(is_error::integer),
    round(avg(duration_ms)),
    percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms::double precision),
    percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms::double precision)
  FROM signals
  WHERE time >= v_from
    AND api_id IS NOT NULL
  GROUP BY 1, 2, 3
  ON CONFLICT (bucket, api_id, region) DO UPDATE SET
    total_signals   = EXCLUDED.total_signals,
    error_count     = EXCLUDED.error_count,
    avg_duration_ms = EXCLUDED.avg_duration_ms,
    p50_ms          = EXCLUDED.p50_ms,
    p95_ms          = EXCLUDED.p95_ms;
END;
$$;

-- The view forgot old signals by being recomputed from them; the table has to
-- be told.
CREATE OR REPLACE FUNCTION public.cleanup_old_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM signals WHERE time < now() - INTERVAL '90 days';
  DELETE FROM signals_1min WHERE bucket < now() - INTERVAL '90 days';
END;
$$;

-- Fill everything since the view's last refresh, in this transaction, so the
-- first worker run starts current.
SELECT public.refresh_signals_1min();

COMMIT;

-- ONE-OFF BACKFILL, only after an outage longer than a day (not part of this
-- migration). Run as postgres, a day at a time:
--
--   INSERT INTO signals_1min AS s (bucket, api_id, region, total_signals,
--     error_count, avg_duration_ms, p50_ms, p95_ms)
--   SELECT time_bucket('1 minute', time), api_id, region, count(*),
--     sum(is_error::integer), round(avg(duration_ms)),
--     percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms::double precision),
--     percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms::double precision)
--   FROM signals
--   WHERE time >= '<day>' AND time < '<day>'::timestamptz + interval '1 day'
--     AND api_id IS NOT NULL
--   GROUP BY 1, 2, 3
--   ON CONFLICT (bucket, api_id, region) DO UPDATE SET
--     total_signals = EXCLUDED.total_signals, error_count = EXCLUDED.error_count,
--     avg_duration_ms = EXCLUDED.avg_duration_ms, p50_ms = EXCLUDED.p50_ms,
--     p95_ms = EXCLUDED.p95_ms;
