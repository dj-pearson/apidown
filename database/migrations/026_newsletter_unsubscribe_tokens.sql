-- Migration 026: Per-subscriber unsubscribe tokens for the weekly digest (US-166)
--
-- The digest needs a one-click unsubscribe link that does not require login and
-- does not leak the address in the URL. A random per-row token does both: it is
-- unguessable, and it identifies exactly one subscription.

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID DEFAULT gen_random_uuid();

-- Backfill any rows created before this column existed.
UPDATE newsletter_subscribers
  SET unsubscribe_token = gen_random_uuid()
  WHERE unsubscribe_token IS NULL;

ALTER TABLE newsletter_subscribers
  ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_unsubscribe_token
  ON newsletter_subscribers (unsubscribe_token);

-- Records the last digest week sent, so a re-run cannot double-send.
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS last_digest_week TEXT;

COMMENT ON COLUMN newsletter_subscribers.unsubscribe_token IS
  'Random token used in the digest unsubscribe link. Never expose the email in a URL.';
COMMENT ON COLUMN newsletter_subscribers.last_digest_week IS
  'ISO week key (YYYY-Www) of the most recent digest sent, so a retry is idempotent.';

-- The sender scans for active subscribers who have not had this week's digest.
CREATE INDEX IF NOT EXISTS idx_newsletter_active_digest
  ON newsletter_subscribers (unsubscribed_at, last_digest_week);
