-- 029: record which Stripe event last changed an account's billing state.
--
-- Stripe gives no ordering guarantee and redelivers on retry, so a
-- subscription.updated generated before a cancellation can arrive after it.
-- Applied blindly that hands a cancelled customer their paid tier back. The
-- webhook now stamps each write with the event's own `created` time and skips
-- any event older than the one already applied to that row.
--
-- Existing rows are left NULL, which means "no event applied yet" — the next
-- event of any age is accepted and becomes the watermark.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_event_applied_at TIMESTAMPTZ;

COMMENT ON COLUMN users.stripe_event_applied_at IS
  'Stripe event.created of the most recent webhook applied to this row. Used to discard out-of-order redeliveries.';
