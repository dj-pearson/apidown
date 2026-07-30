import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { computeReliabilityScore, metricsFromRaw } from '../src/lib/reliability-score.js';

describe('computeReliabilityScore', () => {
  test('a flawless API earns A+', () => {
    const { score, grade } = computeReliabilityScore({
      uptimePct: 100, p95Ms: 80, incidentCount: 0, avgResolutionMin: 0,
    });
    assert.equal(score, 100);
    assert.equal(grade, 'A+');
  });

  test('a badly broken API earns F', () => {
    const { grade } = computeReliabilityScore({
      uptimePct: 85, p95Ms: 6000, incidentCount: 20, avgResolutionMin: 600,
    });
    assert.equal(grade, 'F');
  });

  test('grades degrade monotonically as uptime falls', () => {
    const gradeFor = (uptimePct) =>
      computeReliabilityScore({ uptimePct, p95Ms: 80, incidentCount: 0, avgResolutionMin: 0 }).score;

    const scores = [100, 99.95, 99.9, 99.5, 99, 98, 95, 90, 50].map(gradeFor);
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i] <= scores[i - 1], `score should not rise as uptime falls: ${scores}`);
    }
    assert.ok(scores.at(-1) < scores[0], 'the worst case must score below the best');
  });

  test('weights sum such that uptime dominates', () => {
    // Only uptime differs; the swing must exceed what latency alone can cause.
    const base = { p95Ms: 80, incidentCount: 0, avgResolutionMin: 0 };
    const uptimeSwing =
      computeReliabilityScore({ ...base, uptimePct: 100 }).score -
      computeReliabilityScore({ ...base, uptimePct: 95 }).score;

    const latencyBase = { uptimePct: 100, incidentCount: 0, avgResolutionMin: 0 };
    const latencySwing =
      computeReliabilityScore({ ...latencyBase, p95Ms: 80 }).score -
      computeReliabilityScore({ ...latencyBase, p95Ms: 5000 }).score;

    assert.ok(uptimeSwing > 0 && latencySwing > 0);
    assert.ok(uptimeSwing > latencySwing * 0.9, 'uptime carries the most weight');
  });

  test('returns a colour and a full breakdown', () => {
    const result = computeReliabilityScore({
      uptimePct: 99.9, p95Ms: 150, incidentCount: 2, avgResolutionMin: 25,
    });
    assert.match(result.gradeColor, /^#[0-9a-f]{6}$/i);
    assert.deepEqual(Object.keys(result.breakdown), ['uptime', 'latency', 'incidents', 'resolution']);
    const weights = Object.values(result.breakdown).reduce((sum, b) => sum + b.weight, 0);
    assert.equal(weights, 100, 'weights must add up to 100');
  });

  test('defaults to a usable result with no input', () => {
    const result = computeReliabilityScore({});
    assert.ok(Number.isFinite(result.score));
    assert.ok(result.grade);
  });

  test('no-data latency is treated as decent rather than perfect or zero', () => {
    const noData = computeReliabilityScore({ uptimePct: 100, p95Ms: 0, incidentCount: 0 });
    const fast = computeReliabilityScore({ uptimePct: 100, p95Ms: 80, incidentCount: 0 });
    assert.ok(noData.score < fast.score, 'absent data should not outscore measured speed');
    assert.ok(noData.score > 60, 'absent data should not be punished as an outage');
  });
});

describe('metricsFromRaw', () => {
  test('averages p95 over rows that have data', () => {
    const m = metricsFromRaw({
      uptimePct: 99.9,
      latencyData: [{ p95_ms: 100 }, { p95_ms: 300 }],
      incidents: [],
    });
    assert.equal(m.p95Ms, 200);
    assert.equal(m.incidentCount, 0);
  });

  test('ignores rows with no p95 measurement', () => {
    const m = metricsFromRaw({
      uptimePct: 100,
      latencyData: [{ p95_ms: 200 }, { p95_ms: 0 }, { p95_ms: null }],
      incidents: [],
    });
    assert.equal(m.p95Ms, 200, 'zero and null rows must not drag the average down');
  });

  test('averages resolution time over resolved incidents only', () => {
    const base = Date.UTC(2026, 6, 1);
    const m = metricsFromRaw({
      uptimePct: 100,
      latencyData: [],
      incidents: [
        { started_at: new Date(base).toISOString(), resolved_at: new Date(base + 30 * 60000).toISOString() },
        { started_at: new Date(base).toISOString(), resolved_at: new Date(base + 90 * 60000).toISOString() },
        { started_at: new Date(base).toISOString(), resolved_at: null },
      ],
    });
    assert.equal(m.incidentCount, 3, 'the open incident still counts toward the total');
    assert.equal(m.avgResolutionMin, 60, 'but not toward mean time to resolve');
  });

  test('handles empty and missing inputs', () => {
    const m = metricsFromRaw({ uptimePct: 100 });
    assert.equal(m.p95Ms, 0);
    assert.equal(m.incidentCount, 0);
    assert.equal(m.avgResolutionMin, 0);
  });
});
