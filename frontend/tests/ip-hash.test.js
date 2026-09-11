import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { hashIp, resolveSalt, clientIpFrom, _resetSaltCache } from '../src/lib/server/ip-hash.js';

const quiet = () => {};

describe('resolveSalt', () => {
  beforeEach(() => _resetSaltCache());

  test('uses a configured salt of sufficient length', () => {
    const r = resolveSalt('a-long-enough-random-salt', { warn: quiet });
    assert.equal(r.salt, 'a-long-enough-random-salt');
    assert.equal(r.ephemeral, false);
  });

  test('trims surrounding whitespace', () => {
    assert.equal(resolveSalt('  a-long-enough-random-salt  ', { warn: quiet }).salt, 'a-long-enough-random-salt');
  });

  test('never falls back to a fixed default', () => {
    const a = resolveSalt(undefined, { warn: quiet }).salt;
    _resetSaltCache();
    const b = resolveSalt(undefined, { warn: quiet }).salt;
    assert.notEqual(a, b, 'two processes must not share a salt');
    assert.notEqual(a, 'apidown-salt');
  });

  test('an unset salt is reported as ephemeral and warned about once', () => {
    const warnings = [];
    const warn = m => warnings.push(m);
    assert.equal(resolveSalt(undefined, { warn }).ephemeral, true);
    resolveSalt(undefined, { warn });
    resolveSalt(undefined, { warn });
    assert.equal(warnings.length, 1, 'should not warn on every request');
    assert.match(warnings[0], /IP_HASH_SALT is not set/);
  });

  test('the generated salt is stable within a process', () => {
    const a = resolveSalt(undefined, { warn: quiet }).salt;
    const b = resolveSalt(undefined, { warn: quiet }).salt;
    assert.equal(a, b, 'rate limiting must work within one process lifetime');
  });

  test('the generated salt is long and random-looking', () => {
    const { salt } = resolveSalt(undefined, { warn: quiet });
    assert.equal(salt.length, 64);
    assert.match(salt, /^[0-9a-f]+$/);
  });

  test('rejects a salt that is too short to be useful', () => {
    const warnings = [];
    const r = resolveSalt('short', { warn: m => warnings.push(m) });
    assert.equal(r.ephemeral, true);
    assert.notEqual(r.salt, 'short');
    assert.match(warnings[0], /too short/);
  });

  test('treats a non-string as unset', () => {
    assert.equal(resolveSalt(12345678901234567890, { warn: quiet }).ephemeral, true);
    _resetSaltCache();
    assert.equal(resolveSalt(null, { warn: quiet }).ephemeral, true);
  });
});

describe('hashIp', () => {
  const salt = 'a-long-enough-random-salt';

  test('is deterministic for the same address and salt', async () => {
    assert.equal(await hashIp('203.0.113.7', salt), await hashIp('203.0.113.7', salt));
  });

  test('differs between addresses', async () => {
    assert.notEqual(await hashIp('203.0.113.7', salt), await hashIp('203.0.113.8', salt));
  });

  test('differs between salts — this is what makes enumeration infeasible', async () => {
    assert.notEqual(await hashIp('203.0.113.7', salt), await hashIp('203.0.113.7', salt + 'x'));
  });

  test('returns 128 bits of lowercase hex', async () => {
    const h = await hashIp('203.0.113.7', salt);
    assert.equal(h.length, 32);
    assert.match(h, /^[0-9a-f]{32}$/);
  });

  test('does not contain the address it was given', async () => {
    assert.ok(!(await hashIp('203.0.113.7', salt)).includes('203'));
  });

  test('handles IPv6 and empty input without throwing', async () => {
    assert.match(await hashIp('2001:db8::1', salt), /^[0-9a-f]{32}$/);
    assert.match(await hashIp('', salt), /^[0-9a-f]{32}$/);
    assert.match(await hashIp(undefined, salt), /^[0-9a-f]{32}$/);
  });

  test('is an HMAC, not a plain digest of the concatenation', async () => {
    // The old construction was sha256(ip + salt); make sure we no longer match it.
    const legacy = await (async () => {
      const data = new TextEncoder().encode('203.0.113.7' + salt);
      const d = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    })();
    assert.notEqual(await hashIp('203.0.113.7', salt), legacy);
  });
});

describe('clientIpFrom', () => {
  const from = headers => name => headers[name];

  test('prefers the Cloudflare header', () => {
    assert.equal(
      clientIpFrom(from({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }), '3.3.3.3'),
      '1.1.1.1',
    );
  });

  test('falls back to the first x-forwarded-for entry', () => {
    assert.equal(clientIpFrom(from({ 'x-forwarded-for': '2.2.2.2, 4.4.4.4' }), '3.3.3.3'), '2.2.2.2');
  });

  test('trims whitespace in x-forwarded-for', () => {
    assert.equal(clientIpFrom(from({ 'x-forwarded-for': '  2.2.2.2  , 4.4.4.4' }), ''), '2.2.2.2');
  });

  test('falls back to the socket address', () => {
    assert.equal(clientIpFrom(from({}), '3.3.3.3'), '3.3.3.3');
  });

  test('returns the empty fallback rather than throwing', () => {
    assert.equal(clientIpFrom(from({})), '');
  });
});
