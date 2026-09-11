import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProbeUrl,
  isBlockedHostname,
  isBlockedIp,
  isBlockedIpv4,
  isBlockedIpv6,
  sameOrigin,
} from '../src/lib/safe-url.js';

describe('isBlockedIpv4', () => {
  test('blocks the cloud metadata address', () => {
    assert.equal(isBlockedIpv4('169.254.169.254'), true);
  });

  test('blocks loopback, private and CGNAT ranges', () => {
    for (const ip of [
      '127.0.0.1', '127.1.2.3', '10.0.0.1', '10.255.255.255',
      '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1',
      '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1', '192.0.0.1',
    ]) {
      assert.equal(isBlockedIpv4(ip), true, ip);
    }
  });

  test('allows genuinely public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '192.167.1.1', '100.63.0.1', '99.1.1.1']) {
      assert.equal(isBlockedIpv4(ip), false, ip);
    }
  });

  test('is not fooled by a non-address', () => {
    assert.equal(isBlockedIpv4('example.com'), false);
    assert.equal(isBlockedIpv4('999.1.1.1'), false, 'not a valid IP, judged as a hostname elsewhere');
  });
});

describe('isBlockedIpv6', () => {
  test('blocks loopback, unique-local, link-local and multicast', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '[::1]']) {
      assert.equal(isBlockedIpv6(ip), true, ip);
    }
  });

  test('blocks an IPv4-mapped internal address', () => {
    assert.equal(isBlockedIpv6('::ffff:127.0.0.1'), true);
    assert.equal(isBlockedIpv6('::ffff:169.254.169.254'), true);
  });

  test('allows a public IPv6 address', () => {
    assert.equal(isBlockedIpv6('2606:4700:4700::1111'), false);
  });

  test('ignores anything without a colon', () => {
    assert.equal(isBlockedIpv6('8.8.8.8'), false);
  });
});

describe('isBlockedHostname', () => {
  test('blocks localhost and internal suffixes', () => {
    for (const h of ['localhost', 'LOCALHOST', 'foo.localhost', 'db.local', 'api.internal', 'metadata.google.internal', 'x.home.arpa']) {
      assert.equal(isBlockedHostname(h), true, h);
    }
  });

  test('blocks a single-label name, which is how containers address each other', () => {
    for (const h of ['redis', 'worker', 'ingest', 'supabase']) {
      assert.equal(isBlockedHostname(h), true, h);
    }
  });

  test('blocks a bare IP in any private range', () => {
    assert.equal(isBlockedHostname('169.254.169.254'), true);
    assert.equal(isBlockedHostname('::1'), true);
  });

  test('ignores a trailing dot used to bypass suffix checks', () => {
    assert.equal(isBlockedHostname('localhost.'), true);
  });

  test('blocks an empty or missing hostname', () => {
    assert.equal(isBlockedHostname(''), true);
    assert.equal(isBlockedHostname(null), true);
  });

  test('allows real public hostnames', () => {
    for (const h of ['api.stripe.com', 'example.com', 'sub.domain.co.uk']) {
      assert.equal(isBlockedHostname(h), false, h);
    }
  });
});

describe('parseProbeUrl', () => {
  test('accepts a normal https API URL', () => {
    const r = parseProbeUrl('https://api.stripe.com/v1/charges');
    assert.equal(r.ok, true);
    assert.equal(r.url.hostname, 'api.stripe.com');
  });

  test('rejects the cloud metadata endpoint', () => {
    const r = parseProbeUrl('http://169.254.169.254/latest/meta-data/iam/security-credentials/');
    assert.equal(r.ok, false);
    assert.match(r.reason, /internal or private/);
  });

  test('rejects sibling containers on the compose network', () => {
    assert.equal(parseProbeUrl('http://redis:6379').ok, false);
    assert.equal(parseProbeUrl('http://worker/health').ok, false);
  });

  test('rejects loopback in every spelling', () => {
    for (const u of ['http://localhost:3001/', 'http://127.0.0.1/', 'http://[::1]/', 'http://127.000.000.1/']) {
      assert.equal(parseProbeUrl(u).ok, false, u);
    }
  });

  test('rejects non-http schemes', () => {
    for (const u of ['file:///etc/passwd', 'gopher://x.com/', 'ftp://example.com/', 'data:text/plain,hi']) {
      assert.equal(parseProbeUrl(u).ok, false, u);
    }
  });

  test('rejects credentials embedded in the URL', () => {
    const r = parseProbeUrl('https://user:pass@api.example.com/');
    assert.equal(r.ok, false);
    assert.match(r.reason, /credentials/);
  });

  test('rejects malformed input without throwing', () => {
    for (const u of ['', 'not a url', null, undefined, 'http://']) {
      assert.doesNotThrow(() => parseProbeUrl(u));
      assert.equal(parseProbeUrl(u).ok, false, String(u));
    }
  });
});

describe('sameOrigin', () => {
  test('matches identical origins regardless of path', () => {
    assert.equal(sameOrigin('https://a.com/x', 'https://a.com/y'), true);
  });

  test('rejects a different host, scheme or port', () => {
    assert.equal(sameOrigin('https://a.com/', 'https://b.com/'), false);
    assert.equal(sameOrigin('https://a.com/', 'http://a.com/'), false);
    assert.equal(sameOrigin('https://a.com/', 'https://a.com:8443/'), false);
  });

  test('rejects a subdomain — a credential must not follow one', () => {
    assert.equal(sameOrigin('https://a.com/', 'https://evil.a.com/'), false);
  });

  test('is false for unparseable input rather than throwing', () => {
    assert.equal(sameOrigin('nonsense', 'https://a.com'), false);
  });
});
