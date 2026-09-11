// SHARED MODULE — an identical copy lives at services/ingest/src/lib/safe-url.js.
// frontend/tests/shared-modules.test.js fails if the two drift apart.

/**
 * Deciding whether a user-supplied URL is safe for the probe worker to fetch.
 *
 * Custom APIs let any signed-in user name a URL that the worker then requests
 * every minute from inside the private network. Validating only the scheme
 * makes that a server-side request forgery: http://169.254.169.254/ reaches
 * the cloud metadata service, http://redis:6379 reaches the queue, and a
 * single-label name like http://worker resolves to a sibling container. The
 * response body is never shown to the user, but status codes and timings still
 * leak, and some internal endpoints act on a bare GET.
 *
 * Two checks are needed, not one. A hostname is screened here before the URL
 * is stored, and the resolved address is screened again at probe time —
 * between those two moments the DNS record can change, and a redirect can
 * point somewhere else entirely.
 */

/** Only these schemes are ever fetched. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Hostnames that never belong to a public API. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
]);

/** Suffixes reserved for private or internal naming. */
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa'];

/** Parse an IPv4 address into its four octets, or null. */
function ipv4Octets(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every(n => n >= 0 && n <= 255) ? octets : null;
}

/**
 * True for an IPv4 address that is not routable on the public internet:
 * loopback, private, link-local (including the cloud metadata address),
 * carrier-grade NAT, multicast, broadcast and reserved space.
 */
export function isBlockedIpv4(host) {
  const octets = ipv4Octets(host);
  if (!octets) return false;
  const [a, b] = octets;

  if (a === 0) return true;                          // 0.0.0.0/8 "this network"
  if (a === 10) return true;                         // private
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local, incl. 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;  // private
  if (a === 192 && b === 168) return true;           // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true;             // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true;                         // multicast, reserved, broadcast
  return false;
}

/** The IPv6 equivalents, including addresses that embed an IPv4 one. */
export function isBlockedIpv6(host) {
  const raw = String(host || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!raw.includes(':')) return false;

  if (raw === '::' || raw === '::1') return true;            // unspecified, loopback
  if (/^f[cd][0-9a-f]{2}:/.test(raw)) return true;           // fc00::/7 unique local
  if (/^fe[89ab][0-9a-f]:/.test(raw)) return true;           // fe80::/10 link-local
  if (/^ff[0-9a-f]{2}:/.test(raw)) return true;              // multicast

  // ::ffff:127.0.0.1 and friends: judge the embedded IPv4 address.
  const embedded = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(raw);
  if (embedded) return isBlockedIpv4(embedded[1]);

  return false;
}

/** Either family. */
export function isBlockedIp(host) {
  return isBlockedIpv4(host) || isBlockedIpv6(host);
}

/**
 * True when a hostname must not be fetched.
 *
 * A single-label name — no dot at all — is rejected because on a container
 * network that is how sibling services are addressed (`redis`, `worker`),
 * while a genuine public API always has a registrable domain.
 */
export function isBlockedHostname(host) {
  const name = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!name) return true;
  if (BLOCKED_HOSTNAMES.has(name)) return true;
  if (BLOCKED_SUFFIXES.some(suffix => name.endsWith(suffix))) return true;
  if (isBlockedIp(name)) return true;
  if (!name.includes('.')) return true;
  return false;
}

/**
 * Validate a URL for probing.
 * Returns `{ ok: true, url }` with a parsed URL, or `{ ok: false, reason }`.
 */
export function parseProbeUrl(raw) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: 'must be an http or https URL' };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'credentials in the URL are not supported' };
  }
  if (isBlockedHostname(url.hostname)) {
    return { ok: false, reason: 'must be a public hostname, not an internal or private address' };
  }
  return { ok: true, url };
}

/**
 * Whether an auth header may travel to `nextUrl` given the original target.
 * A redirect to another origin must not carry the customer's credential.
 */
export function sameOrigin(a, b) {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.protocol === y.protocol && x.host === y.host;
  } catch {
    return false;
  }
}
