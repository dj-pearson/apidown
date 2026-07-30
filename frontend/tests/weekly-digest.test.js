import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  weekKey,
  isValidWeekKey,
  weekWindow,
  recentWeekKeys,
  previousWeekKey,
  nextWeekKey,
  buildDigest,
  formatMinutes,
} from '../src/lib/weekly-digest.js';

const H = 60 * 60 * 1000;
const WEEK = 7 * 24 * H;

describe('ISO week keys', () => {
  test('matches ISO-8601 numbering at year boundaries', () => {
    // 2024-12-30 is a Monday belonging to ISO week 1 of 2025.
    assert.equal(weekKey(Date.UTC(2024, 11, 30)), '2025-W01');
    // 2023-01-01 is a Sunday belonging to the last week of 2022.
    assert.equal(weekKey(Date.UTC(2023, 0, 1)), '2022-W52');
    assert.equal(weekKey(Date.UTC(2026, 0, 1)), '2026-W01');
    assert.equal(weekKey(Date.UTC(2026, 6, 30)), '2026-W31');
  });

  test('every day of one week maps to the same key', () => {
    const monday = weekWindow('2026-W31').start;
    const keys = new Set();
    for (let d = 0; d < 7; d++) keys.add(weekKey(monday + d * 24 * H));
    assert.equal(keys.size, 1);
    assert.deepEqual([...keys], ['2026-W31']);
  });

  test('isValidWeekKey rejects malformed and out-of-range keys', () => {
    assert.ok(isValidWeekKey('2026-W31'));
    assert.ok(isValidWeekKey('2026-W53'), 'some years have 53 ISO weeks');
    assert.ok(!isValidWeekKey('2026-W54'));
    assert.ok(!isValidWeekKey('2026-W00'));
    assert.ok(!isValidWeekKey('2026-31'), 'missing the W');
    assert.ok(!isValidWeekKey('2026-W7'), 'week must be zero-padded');
    assert.ok(!isValidWeekKey(''));
    assert.ok(!isValidWeekKey(undefined));
  });
});

describe('week windows', () => {
  test('starts on Monday 00:00 UTC and spans exactly seven days', () => {
    const { start, end } = weekWindow('2026-W31');
    assert.equal(new Date(start).getUTCDay(), 1, 'Monday');
    assert.equal(new Date(start).toISOString(), '2026-07-27T00:00:00.000Z');
    assert.equal(end - start, WEEK);
  });

  test('round-trips through weekKey at both edges', () => {
    const { start, end } = weekWindow('2026-W31');
    assert.equal(weekKey(start), '2026-W31');
    assert.equal(weekKey(end - 1), '2026-W31', 'last millisecond still in the week');
    assert.equal(weekKey(end), '2026-W32', 'the boundary belongs to the next week');
  });

  test('previous and next cross year boundaries correctly', () => {
    assert.equal(previousWeekKey('2026-W01'), '2025-W52');
    assert.equal(nextWeekKey('2026-W01'), '2026-W02');
    assert.equal(nextWeekKey('2025-W52'), '2026-W01');
  });

  test('recentWeekKeys starts from the last complete week', () => {
    const now = Date.UTC(2026, 6, 30); // Thursday of 2026-W31
    const keys = recentWeekKeys(3, now);
    assert.deepEqual(keys, ['2026-W30', '2026-W29', '2026-W28']);
    assert.ok(!keys.includes('2026-W31'), 'the in-progress week is excluded');
  });
});

describe('buildDigest', () => {
  const week = '2026-W31';
  const { start, end } = weekWindow(week);
  const after = end + H;

  const apis = [
    { id: 'a', slug: 'openai', name: 'OpenAI', category: 'ai' },
    { id: 'b', slug: 'stripe', name: 'Stripe', category: 'payments' },
    { id: 'c', slug: 'groq', name: 'Groq', category: 'ai' },
  ];

  const incidents = [
    { id: 'i1', api_id: 'a', severity: 'critical', title: 'Elevated errors',
      started_at: new Date(start + 2 * H).toISOString(), resolved_at: new Date(start + 5 * H).toISOString() },
    { id: 'i2', api_id: 'b', severity: 'minor', title: 'Slow webhooks',
      started_at: new Date(start - 3 * H).toISOString(), resolved_at: new Date(start + 1 * H).toISOString() },
    { id: 'i3', api_id: 'a', severity: 'major', title: 'Region outage',
      started_at: new Date(start + 40 * H).toISOString(), resolved_at: new Date(start + 41 * H).toISOString() },
  ];

  const latencyThisWeek = [
    { api_id: 'a', p95_ms: 900, total_signals: 100 },
    { api_id: 'b', p95_ms: 200, total_signals: 100 },
    { api_id: 'c', p95_ms: 100, total_signals: 50 },
  ];
  const latencyPriorWeek = [
    { api_id: 'a', p95_ms: 600, total_signals: 100 },
    { api_id: 'b', p95_ms: 195, total_signals: 100 },
    { api_id: 'c', p95_ms: 250, total_signals: 50 },
  ];

  const digest = buildDigest({ week, apis, incidents, latencyThisWeek, latencyPriorWeek, now: after });

  test('clips a week-spanning incident to the week', () => {
    const stripe = digest.biggestOutages.find(o => o.apiSlug === 'stripe');
    assert.equal(stripe.durationMinutes, 60, 'only the hour inside the week counts');
  });

  test('orders outages longest first', () => {
    assert.deepEqual(
      digest.biggestOutages.map(o => o.durationMinutes),
      [180, 60, 60],
    );
  });

  test('totals downtime and distinct affected APIs', () => {
    assert.equal(digest.totals.incidents, 3);
    assert.equal(digest.totals.apisAffected, 2, 'OpenAI twice counts once');
    assert.equal(digest.totals.downtimeMinutes, 300);
    assert.equal(digest.totals.apisTracked, 3);
  });

  test('reports latency regressions and improvements above the noise floor', () => {
    assert.deepEqual(digest.regressions.map(m => [m.apiName, m.changePct]), [['OpenAI', 50]]);
    assert.deepEqual(digest.improvements.map(m => [m.apiName, m.changePct]), [['Groq', -60]]);
  });

  test('filters movement below ten percent as noise', () => {
    // Stripe moved 195ms to 200ms — about 2.6%, not worth reporting.
    const named = [...digest.regressions, ...digest.improvements].map(m => m.apiSlug);
    assert.ok(!named.includes('stripe'), 'small movement should be filtered');
  });

  test('needs both weeks of data to call a movement', () => {
    const d = buildDigest({
      week, apis, incidents: [],
      latencyThisWeek: [{ api_id: 'a', p95_ms: 900, total_signals: 10 }],
      latencyPriorWeek: [],
      now: after,
    });
    assert.equal(d.regressions.length, 0, 'no prior week means no comparison');
  });

  test('groups downtime by category, worst first', () => {
    assert.deepEqual(
      digest.categories.map(c => [c.label, c.count, c.downtimeMinutes]),
      [['AI / LLM', 2, 240], ['Payments', 1, 60]],
    );
  });

  test('lists untouched APIs as a clean sheet', () => {
    assert.equal(digest.cleanSheetCount, 1);
    assert.deepEqual(digest.cleanSheet.map(a => a.slug), ['groq']);
  });

  test('is deterministic regardless of input ordering', () => {
    const reversed = buildDigest({
      week,
      apis: [...apis].reverse(),
      incidents: [...incidents].reverse(),
      latencyThisWeek: [...latencyThisWeek].reverse(),
      latencyPriorWeek: [...latencyPriorWeek].reverse(),
      now: after,
    });
    assert.deepEqual(reversed, digest, 'the archive must be stable for a given week');
  });

  test('produces a truthful quiet-week digest', () => {
    const quiet = buildDigest({ week, apis, incidents: [], now: after });
    assert.equal(quiet.totals.incidents, 0);
    assert.equal(quiet.totals.downtimeMinutes, 0);
    assert.equal(quiet.cleanSheetCount, 3);
    assert.match(quiet.headline, /quiet week/i);
    assert.deepEqual(quiet.biggestOutages, []);
  });

  test('caps each list so the email stays readable', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `x${i}`, api_id: 'a', severity: 'minor', title: `Blip ${i}`,
      started_at: new Date(start + i * H).toISOString(),
      resolved_at: new Date(start + i * H + 30 * 60 * 1000).toISOString(),
    }));
    const d = buildDigest({ week, apis, incidents: many, now: after });
    assert.equal(d.biggestOutages.length, 5);
    assert.equal(d.totals.incidents, 20, 'the total still reflects everything');
  });
});

describe('formatMinutes', () => {
  test('formats across the range', () => {
    assert.equal(formatMinutes(0), '0m');
    assert.equal(formatMinutes(45), '45m');
    assert.equal(formatMinutes(60), '1h');
    assert.equal(formatMinutes(150), '2h 30m');
    assert.equal(formatMinutes(1440), '1d');
    assert.equal(formatMinutes(1500), '1d 1h');
  });
});
