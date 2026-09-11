/**
 * Normalising the timestamp on an incoming signal.
 *
 * Two things go wrong with `ts` in practice, and both used to be silent.
 *
 * The first is units. Plenty of languages hand you epoch *seconds* —
 * time.time(), Go's Unix(), PHP's time() — so an SDK integration that passes
 * seconds produces `new Date(1737000000)`, which is January 1970. The signal
 * was accepted, the endpoint returned 202, and the data then sat outside every
 * dashboard window forever. From the customer's side the SDK works and their
 * API simply never appears.
 *
 * The second is range. `new Date(1e20).toISOString()` throws a RangeError, so
 * one malformed value took down the whole batch with a 500 rather than being
 * skipped.
 *
 * Both are handled here: seconds are promoted to milliseconds, anything
 * outside a sane window is rejected with a reason, and nothing throws.
 */

/** Below this, a value cannot be milliseconds for any plausible date. */
const SECONDS_CUTOFF = 1e11; // 1e11 ms is 1973; 1e11 s is the year 5138.

/** Tolerated clock skew on a client that is running slightly fast. */
export const MAX_FUTURE_MS = 5 * 60 * 1000;

/** Signals older than this are of no use to a 5-minute detection window. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns `{ ok: true, ms, iso, unit }` or `{ ok: false, reason }`.
 * `unit` reports what the input was read as, so callers can warn about an SDK
 * sending seconds rather than silently correcting it forever.
 */
export function normalizeTimestamp(ts, now = Date.now()) {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) {
    return { ok: false, reason: 'not a finite number' };
  }

  // Zero and negatives predate the epoch; nothing legitimate sends them.
  if (ts <= 0) {
    return { ok: false, reason: 'not a positive timestamp' };
  }

  const unit = ts < SECONDS_CUTOFF ? 'seconds' : 'milliseconds';
  const ms = Math.round(unit === 'seconds' ? ts * 1000 : ts);

  if (ms > now + MAX_FUTURE_MS) {
    return { ok: false, reason: 'timestamp is in the future' };
  }
  if (ms < now - MAX_AGE_MS) {
    return { ok: false, reason: 'timestamp is too old' };
  }

  // Belt and braces: never hand a value to toISOString that could throw.
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, reason: 'not a representable date' };
  }

  return { ok: true, ms, iso: date.toISOString(), unit };
}
