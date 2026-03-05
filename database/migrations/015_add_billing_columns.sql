-- Migration 015: Billing-related columns

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_stripe ON users (stripe_customer_id);
