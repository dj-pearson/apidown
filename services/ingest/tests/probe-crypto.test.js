import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { maskAuthValue } from '../src/lib/probe-crypto.js';

/**
 * probe_auth_hint is stored on the row and returned by the custom-APIs
 * endpoint, so whatever this function keeps is disclosed.
 */
describe('maskAuthValue', () => {
  test('reveals nothing at all for a short secret', () => {
    // "first four plus last four" of an eight-character secret is the secret.
    for (const secret of ['abcd1234', 'secret12', 'shortkey', 'a', 'abcdefghijklmno']) {
      const masked = maskAuthValue(secret);
      assert.ok(!masked.includes(secret), `${secret} leaked as ${masked}`);
      assert.equal(/[a-z0-9]/i.test(masked), false, `${masked} still contains characters`);
    }
  });

  test('an eight-character secret is no longer fully disclosed', () => {
    assert.equal(maskAuthValue('abcd1234'), '********');
  });

  test('reveals at most the last four characters of a long secret', () => {
    const secret = 'sk-ant-api03-abc123xyz789';
    const masked = maskAuthValue(secret);
    assert.equal(masked, '********z789');
    assert.ok(!masked.includes('sk-ant'), 'the leading characters are not shown');
  });

  test('never discloses more than four characters', () => {
    for (const secret of ['0123456789abcdef', 'x'.repeat(200), 'Bearer ' + 'y'.repeat(60)]) {
      const revealed = maskAuthValue(secret).replace(/\*/g, '');
      assert.ok(revealed.length <= 4, `revealed ${revealed.length} characters`);
      assert.ok(secret.endsWith(revealed), 'only a suffix is shown');
    }
  });

  test('the boundary is exact', () => {
    assert.equal(maskAuthValue('x'.repeat(15)), '********', '15 is too short to reveal');
    assert.equal(maskAuthValue('x'.repeat(16)).length, 12, '16 reveals four');
  });

  test('handles empty and missing input', () => {
    assert.equal(maskAuthValue(''), null);
    assert.equal(maskAuthValue(null), null);
    assert.equal(maskAuthValue(undefined), null);
  });

  test('does not throw on a non-string', () => {
    assert.doesNotThrow(() => maskAuthValue(1234567890123456789));
  });
});
