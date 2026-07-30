-- Migration 024: Published vendor SLA targets on the apis table (US-159)
--
-- Note the difference from the existing `sla_targets` table: that one holds a
-- *user's own* private target for an API. These columns hold the *vendor's
-- publicly published* uptime commitment, so /sla-receipts can compare what a
-- vendor promised against what APIdown actually measured.
--
-- published_sla_pct is intentionally NULL by default. A NULL means "we have no
-- published SLA on file for this vendor" and the receipts page lists those
-- separately rather than treating them as failures. Never guess a value here —
-- an unsourced number would make the whole page untrustworthy. Only fill a row
-- in when published_sla_url points at the vendor document stating it.

ALTER TABLE apis ADD COLUMN IF NOT EXISTS published_sla_pct NUMERIC(6,3);
ALTER TABLE apis ADD COLUMN IF NOT EXISTS published_sla_url TEXT;
ALTER TABLE apis ADD COLUMN IF NOT EXISTS published_sla_note TEXT;

COMMENT ON COLUMN apis.published_sla_pct IS
  'Vendor''s publicly published monthly uptime commitment, e.g. 99.9. NULL when none is on file.';
COMMENT ON COLUMN apis.published_sla_url IS
  'URL of the vendor SLA document that states published_sla_pct. Required whenever published_sla_pct is set.';
COMMENT ON COLUMN apis.published_sla_note IS
  'Scope caveats, e.g. which tier or which service the commitment covers.';

-- Enforce the sourcing rule at the schema level: a percentage cannot be stored
-- without the document it came from.
ALTER TABLE apis DROP CONSTRAINT IF EXISTS apis_published_sla_sourced;
ALTER TABLE apis ADD CONSTRAINT apis_published_sla_sourced
  CHECK (published_sla_pct IS NULL OR published_sla_url IS NOT NULL);

-- ── Seed: vendors publishing a per-service monthly uptime commitment ──
-- Each of these comes from the vendor's own SLA page linked in the same row.
-- The remaining tracked APIs are deliberately left NULL until someone verifies
-- their published figure against the vendor's document.

UPDATE apis SET
  published_sla_pct = 99.9,
  published_sla_url = 'https://aws.amazon.com/s3/sla/',
  published_sla_note = 'Monthly Uptime Percentage for S3 Standard.'
WHERE slug = 'aws-s3' AND published_sla_pct IS NULL;

UPDATE apis SET
  published_sla_pct = 99.95,
  published_sla_url = 'https://aws.amazon.com/lambda/sla/',
  published_sla_note = 'Monthly Uptime Percentage for AWS Lambda.'
WHERE slug = 'aws-lambda' AND published_sla_pct IS NULL;

UPDATE apis SET
  published_sla_pct = 99.9,
  published_sla_url = 'https://aws.amazon.com/ses/sla/',
  published_sla_note = 'Monthly Uptime Percentage for Amazon SES.'
WHERE slug = 'aws-ses' AND published_sla_pct IS NULL;

UPDATE apis SET
  published_sla_pct = 99.9,
  published_sla_url = 'https://aws.amazon.com/cloudfront/sla/',
  published_sla_note = 'Monthly Uptime Percentage for Amazon CloudFront.'
WHERE slug = 'aws-cloudfront' AND published_sla_pct IS NULL;

UPDATE apis SET
  published_sla_pct = 99.95,
  published_sla_url = 'https://www.twilio.com/en-us/legal/service-level-agreement',
  published_sla_note = 'Twilio Service Level Agreement, monthly availability.'
WHERE slug = 'twilio' AND published_sla_pct IS NULL;
