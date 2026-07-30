import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  monthKey,
  isValidMonthKey,
  monthWindow,
  recentMonthKeys,
  downtimeMsInWindow,
  uptimePctInWindow,
  longestOutageMsInWindow,
  monthlyBreakdown,
  formatDuration,
} from '../src/lib/api-history.js';

const H = 60 * 60 * 1000;

/** Incident row helper: hours offset from a base instant. */
const inc = (base, startH, endH) => ({
  started_at: new Date(base + startH * H).toISOString(),
  resolved_at: endH === null ? null : new Date(base + endH * H).toISOString(),
});

describe('month keys and windows', () => {
  test('monthKey uses UTC', () => {
    assert.equal(monthKey(Date.UTC(2026, 6, 15)), '2026-07');
    assert.equal(monthKey(Date.UTC(2026, 0, 1)), '2026-01');
    assert.equal(monthKey(Date.UTC(2026, 11, 31)), '2026-12');
  });

  test('isValidMonthKey rejects malformed and out-of-range keys', () => {
    assert.ok(isValidMonthKey('2026-07'));
    assert.ok(!isValidMonthKey('2026-13'), 'month 13 is not valid');
    assert.ok(!isValidMonthKey('2026-00'), 'month 0 is not valid');
    assert.ok(!isValidMonthKey('2026-7'), 'month must be zero-padded');
    assert.ok(!isValidMonthKey('nonsense'));
    assert.ok(!isValidMonthKey(''));
    assert.ok(!isValidMonthKey(undefined));
    assert.ok(!isValidMonthKey('1999-07'), 'before the supported range');
  });

  test('monthWindow spans exactly one month and rolls over December', () => {
    const july = monthWindow('2026-07');
    assert.equal(new Date(july.start).toISOString(), '2026-07-01T00:00:00.000Z');
    assert.equal(new Date(july.end).toISOString(), '2026-08-01T00:00:00.000Z');
    assert.equal(july.label, 'July 2026');

    const december = monthWindow('2026-12');
    assert.equal(new Date(december.end).toISOString(), '2027-01-01T00:00:00.000Z');
  });

  test('recentMonthKeys walks backwards across a year boundary', () => {
    assert.deepEqual(recentMonthKeys(4, Date.UTC(2026, 1, 10)), [
      '2026-02', '2026-01', '2025-12', '2025-11',
    ]);
  });
});

describe('downtime attribution', () => {
  const { start, end } = monthWindow('2026-07');
  const now = Date.UTC(2026, 6, 15, 12);

  test('sums non-overlapping incidents', () => {
    const incidents = [inc(start, 2, 3), inc(start, 10, 12)];
    assert.equal(downtimeMsInWindow(incidents, start, end, now), 3 * H);
  });

  test('merges overlapping incidents instead of double-counting', () => {
    // 00:00-03:00 and 01:00-04:00 overlap; the union is four hours, not six.
    const incidents = [inc(start, 0, 3), inc(start, 1, 4)];
    assert.equal(downtimeMsInWindow(incidents, start, end, now), 4 * H);
  });

  test('merges a fully contained incident', () => {
    const incidents = [inc(start, 0, 6), inc(start, 2, 3)];
    assert.equal(downtimeMsInWindow(incidents, start, end, now), 6 * H);
  });

  test('treats adjacent incidents as one continuous outage', () => {
    const incidents = [inc(start, 0, 2), inc(start, 2, 4)];
    assert.equal(downtimeMsInWindow(incidents, start, end, now), 4 * H);
  });

  test('runs an unresolved incident up to now, not to the end of the month', () => {
    const incidents = [{ started_at: new Date(now - 2 * H).toISOString(), resolved_at: null }];
    assert.equal(downtimeMsInWindow(incidents, start, end, now), 2 * H);
  });

  test('clips an incident that started before the window', () => {
    const incidents = [inc(start, -5, 1)];
    assert.equal(downtimeMsInWindow(incidents, start, end, now), 1 * H);
  });

  test('clips an incident that ends after the window', () => {
    const augustNow = Date.UTC(2026, 7, 5);
    // Starts 2h before the month ends, resolves two days into August.
    const incidents = [inc(end, -2, 48)];
    assert.equal(downtimeMsInWindow(incidents, start, end, augustNow), 2 * H);
  });

  test('ignores incidents entirely outside the window', () => {
    assert.equal(downtimeMsInWindow([inc(start, -100, -90)], start, end, now), 0);
  });

  test('handles empty and malformed input without throwing', () => {
    assert.equal(downtimeMsInWindow([], start, end, now), 0);
    assert.equal(downtimeMsInWindow(null, start, end, now), 0);
    assert.equal(downtimeMsInWindow([{ started_at: 'not-a-date' }], start, end, now), 0);
  });
});

describe('uptime percentage', () => {
  const { start, end } = monthWindow('2026-07');

  test('a clean window is 100%', () => {
    assert.equal(uptimePctInWindow([], start, end, Date.UTC(2026, 6, 15)), 100);
  });

  test('prorates against elapsed time in an in-progress month', () => {
    const now = Date.UTC(2026, 6, 15, 12);
    const elapsed = now - start;
    const pct = uptimePctInWindow([inc(start, 0, 4)], start, end, now);
    const expected = Math.round((1 - (4 * H) / elapsed) * 100 * 1000) / 1000;
    assert.equal(pct, expected);
    assert.ok(pct > 98 && pct < 100, `expected a high but sub-100 figure, got ${pct}`);
  });

  test('returns null for a window that has not started', () => {
    const september = monthWindow('2026-09');
    assert.equal(
      uptimePctInWindow([], september.start, september.end, Date.UTC(2026, 6, 15)),
      null,
    );
  });

  test('never reports a negative percentage', () => {
    const now = Date.UTC(2026, 6, 2);
    // An outage covering the entire elapsed window.
    const pct = uptimePctInWindow([inc(start, 0, 48)], start, end, now);
    assert.equal(pct, 0);
  });

  test('rounds to three decimal places', () => {
    const now = Date.UTC(2026, 7, 1);
    const pct = uptimePctInWindow([inc(start, 0, 1)], start, end, now);
    assert.equal(String(pct).split('.')[1]?.length <= 3, true, `too many decimals: ${pct}`);
  });
});

describe('longest single outage', () => {
  const { start, end } = monthWindow('2026-07');
  const now = Date.UTC(2026, 6, 20);

  test('picks the longest, not the sum', () => {
    const incidents = [inc(start, 0, 1), inc(start, 5, 8), inc(start, 20, 22)];
    assert.equal(longestOutageMsInWindow(incidents, start, end, now), 3 * H);
  });

  test('measures the clipped span, not the original span', () => {
    // Ten hours long, but only one hour falls inside the window.
    assert.equal(longestOutageMsInWindow([inc(start, -9, 1)], start, end, now), 1 * H);
  });

  test('is zero with no incidents', () => {
    assert.equal(longestOutageMsInWindow([], start, end, now), 0);
  });
});

describe('monthlyBreakdown', () => {
  const now = Date.UTC(2026, 6, 15, 12);

  test('buckets incidents into the months they overlap', () => {
    const july = monthWindow('2026-07').start;
    const june = monthWindow('2026-06').start;
    const rows = monthlyBreakdown([inc(july, 2, 5), inc(june, 10, 11)], 3, now);

    assert.deepEqual(rows.map(r => r.month), ['2026-07', '2026-06', '2026-05']);
    assert.equal(rows[0].incidentCount, 1);
    assert.equal(rows[0].downtimeMs, 3 * H);
    assert.equal(rows[1].incidentCount, 1);
    assert.equal(rows[2].incidentCount, 0);
    assert.equal(rows[2].uptimePct, 100);
  });

  test('counts a month-spanning incident in both months', () => {
    const july = monthWindow('2026-07').start;
    const rows = monthlyBreakdown([inc(july, -2, 2)], 2, now);
    assert.equal(rows[0].incidentCount, 1, 'counted in July');
    assert.equal(rows[1].incidentCount, 1, 'also counted in June');
    assert.equal(rows[0].downtimeMs, 2 * H, 'July only sees its own two hours');
    assert.equal(rows[1].downtimeMs, 2 * H, 'June only sees its own two hours');
  });

  test('orders each month newest incident first', () => {
    const july = monthWindow('2026-07').start;
    const rows = monthlyBreakdown([inc(july, 1, 2), inc(july, 100, 101)], 1, now);
    assert.equal(rows[0].incidents.length, 2);
    assert.ok(
      new Date(rows[0].incidents[0].started_at) > new Date(rows[0].incidents[1].started_at),
    );
  });
});

describe('formatDuration', () => {
  test('formats across the range and treats sub-second as no data', () => {
    assert.equal(formatDuration(0), '—');
    assert.equal(formatDuration(null), '—');
    assert.equal(formatDuration(500), '—');
    assert.equal(formatDuration(45 * 60 * 1000), '45m');
    assert.equal(formatDuration(2 * H), '2h');
    assert.equal(formatDuration(2.5 * H), '2h 30m');
    assert.equal(formatDuration(25 * H), '1d 1h');
    assert.equal(formatDuration(48 * H), '2d');
  });
});
