-- Migration 027: Web push subscriptions for watched APIs (US-156)
--
-- Free-tier browser notifications. A row is one browser's push endpoint plus the
-- set of API slugs that browser wants to hear about. There is deliberately no
-- user_id: the whole point is that someone can be notified without an account.
-- The endpoint URL is the only identifier, and it is opaque and revocable by the
-- browser at any time.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  api_ids UUID[] NOT NULL DEFAULT '{}',
  min_severity TEXT NOT NULL DEFAULT 'major'
    CHECK (min_severity IN ('critical', 'major', 'minor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_notified_at TIMESTAMPTZ,
  -- Set when the push service reports the endpoint is gone (404/410), so the
  -- sender stops retrying without losing the record immediately.
  failed_at TIMESTAMPTZ
);

-- The sender's query is "live subscriptions watching this API".
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_api_ids
  ON push_subscriptions USING GIN (api_ids);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_live
  ON push_subscriptions (failed_at) WHERE failed_at IS NULL;

-- Only the service role touches this table; browsers go through the endpoints,
-- which validate input and never return anyone else's subscription.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_service_role" ON push_subscriptions;
CREATE POLICY "push_subscriptions_service_role"
  ON push_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE push_subscriptions IS
  'Web Push endpoints for anonymous API watch notifications. No user_id by design — no account required.';
COMMENT ON COLUMN push_subscriptions.api_ids IS
  'APIs this browser wants notifications for. Empty array means the subscription is dormant.';
COMMENT ON COLUMN push_subscriptions.failed_at IS
  'Stamped when the push service reports the endpoint is gone, so the sender skips it.';
