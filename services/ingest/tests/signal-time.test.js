import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTimestamp, MAX_FUTURE_MS, MAX_AGE_MS } from '../src/lib/signal-time.js';

const NOW = Date.parse('2026-09-11T00:00:00.000Z');

describe('normalizeTimestamp — milliseconds', () => {
  test('accepts a current millisecond timestamp unchanged', () => {
    const r = normalizeTimestamp(NOW, NOW);
    assert.equal(r.ok, true);
    assert.equal(r.ms, NOW);
    assert.equal(r.unit, 'milliseconds');
    assert.equal(r.iso, '2026-09-11T00:00:00.000Z');
  });

  test('accepts a timestamp from a few minutes ago', () => {
    const r = normalizeTimestamp(NOW - 120_000, NOW);
    assert.equal(r.ok, true);
    assert.equal(r.ms, NOW - 120_000);
  });

  test('rounds a fractional millisecond value', () => {
    assert.equal(normalizeTimestamp(NOW + 0.6, NOW).ms, NOW + 1);
  });
});

describe('normalizeTimestamp — seconds sent by mistake', () => {
  test('promotes epoch seconds to milliseconds', () => {
    const seconds = Math.floor(NOW / 1000);
    const r = normalizeTimestamp(seconds, NOW);
    assert.equal(r.ok, true);
    assert.equal(r.ms, seconds * 1000);
    assert.equal(r.unit, 'seconds', 'the caller needs to know so it can warn');
  });

  test('a seconds timestamp no longer lands in 1970', () => {
    const r = normalizeTimestamp(Math.floor(NOW / 1000), NOW);
    assert.ok(r.iso.startsWith('2026-'), `got ${r.iso}`);
  });

  test('the unit boundary does not misread a real millisecond value', () => {
    // Any ms timestamp for a plausible date is far above the cutoff.
    assert.equal(normalizeTimestamp(NOW, NOW).unit, 'milliseconds');
    assert.equal(normalizeTimestamp(Date.parse('2001-01-01'), Date.parse('2001-01-02')).unit, 'milliseconds');
  });
});

describe('normalizeTimestamp — values that used to crash the batch', () => {
  test('rejects a value too large for a Date instead of throwing', () => {
    // new Date(1e20).toISOString() raises RangeError.
    const r = normalizeTimestamp(1e20, NOW);
    assert.equal(r.ok, false);
    assert.match(r.reason, /future/);
  });

  test('rejects a hugely negative value instead of throwing', () => {
    const r = normalizeTimestamp(-1e20, NOW);
    assert.equal(r.ok, false);
  });

  test('never throws for any hostile input', () => {
    const hostile = [
      NaN, Infinity, -Infinity, 0, -1, 1e20, -1e20,
      '1737000000', null, undefined, {}, [], true, 1e308, Number.MAX_SAFE_INTEGER,
    ];
    for (const value of hostile) {
      assert.doesNotThrow(() => normalizeTimestamp(value, NOW), `threw on ${String(value)}`);
      const r = normalizeTimestamp(value, NOW);
      if (r.ok) assert.doesNotThrow(() => new Date(r.ms).toISOString());
    }
  });

  test('rejects non-numeric input', () => {
    assert.equal(normalizeTimestamp('1737000000', NOW).ok, false);
    assert.equal(normalizeTimestamp(null, NOW).ok, false);
    assert.equal(normalizeTimestamp(undefined, NOW).ok, false);
    assert.equal(normalizeTimestamp({}, NOW).ok, false);
  });

  test('rejects NaN and infinities with a clear reason', () => {
    assert.match(normalizeTimestamp(NaN, NOW).reason, /finite/);
    assert.match(normalizeTimestamp(Infinity, NOW).reason, /finite/);
  });

  test('rejects zero and negative timestamps', () => {
    assert.match(normalizeTimestamp(0, NOW).reason, /positive/);
    assert.match(normalizeTimestamp(-1, NOW).reason, /positive/);
  });
});

describe('normalizeTimestamp — window bounds', () => {
  test('tolerates mild clock skew into the future', () => {
    assert.equal(normalizeTimestamp(NOW + MAX_FUTURE_MS - 1000, NOW).ok, true);
  });

  test('rejects a timestamp beyond the skew allowance', () => {
    const r = normalizeTimestamp(NOW + MAX_FUTURE_MS + 1000, NOW);
    assert.equal(r.ok, false);
    assert.match(r.reason, /future/);
  });

  test('a badly skewed client cannot poison future windows', () => {
    const nextYear = NOW + 365 * 24 * 60 * 60 * 1000;
    assert.equal(normalizeTimestamp(nextYear, NOW).ok, false);
  });

  test('accepts a signal from within the retention window', () => {
    assert.equal(normalizeTimestamp(NOW - MAX_AGE_MS + 60_000, NOW).ok, true);
  });

  test('rejects a signal older than the retention window', () => {
    const r = normalizeTimestamp(NOW - MAX_AGE_MS - 60_000, NOW);
    assert.equal(r.ok, false);
    assert.match(r.reason, /old/);
  });

  test('a 1970 millisecond timestamp is rejected as too old', () => {
    assert.equal(normalizeTimestamp(1000, NOW).ok, false);
  });
});
