// SHARED MODULE — an identical copy lives at services/ingest/src/lib/ip-hash.js.
// tests/shared-modules.test.js fails if the two drift apart.

/**
 * Pseudonymising reporter IPs.
 *
 * "I'm seeing this too" is deliberately unauthenticated, so the only way to
 * bound abuse is to key a rate limit on something derived from the caller.
 * That derivation has to be genuinely one-way, because the result is written
 * to a table that then describes who reported which outage and when.
 *
 * A plain SHA-256 of the IP with a salt that ships in the source code is not
 * one-way in any useful sense: the whole IPv4 space is 2^32 values, so an
 * attacker with the salt can enumerate every possible hash in minutes and turn
 * the column straight back into addresses. That is why there is no default
 * salt here — a missing one produces a random per-process key and a loud
 * warning instead, which degrades rate limiting rather than privacy.
 */

const HASH_HEX_LENGTH = 32; // 128 bits — ample for a rate-limit key.

let ephemeralSalt = null;
let warned = false;

/**
 * Decide which salt to use.
 *
 * Returns `{ salt, ephemeral }`. `ephemeral` is true when no salt was
 * configured and a random per-process one was generated, which means rate
 * limits will not hold across restarts or between instances.
 */
export function resolveSalt(configured, { warn = console.warn } = {}) {
  const trimmed = typeof configured === 'string' ? configured.trim() : '';
  if (trimmed.length >= 16) {
    return { salt: trimmed, ephemeral: false };
  }

  if (!ephemeralSalt) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    ephemeralSalt = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  if (!warned) {
    warned = true;
    warn(
      trimmed
        ? '[ip-hash] IP_HASH_SALT is too short (need at least 16 characters); using a random per-process salt. Rate limits will not persist across restarts.'
        : '[ip-hash] IP_HASH_SALT is not set; using a random per-process salt. Rate limits will not persist across restarts. Set IP_HASH_SALT to a long random string.',
    );
  }
  return { salt: ephemeralSalt, ephemeral: true };
}

/** Reset the module's memoised state. Tests only. */
export function _resetSaltCache() {
  ephemeralSalt = null;
  warned = false;
}

/**
 * HMAC-SHA-256 of the address under `salt`, truncated to 128 bits.
 *
 * HMAC rather than hash(ip + salt): the salt is a key here, and a keyed
 * construction is the right primitive for that job.
 */
export async function hashIp(ip, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(String(ip ?? '')));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, HASH_HEX_LENGTH);
}

/** The caller's address, preferring the proxy headers we actually sit behind. */
export function clientIpFrom(headerGet, fallback = '') {
  return (
    headerGet('cf-connecting-ip') ||
    headerGet('x-forwarded-for')?.split(',')[0]?.trim() ||
    fallback
  );
}
