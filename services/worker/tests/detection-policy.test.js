import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWindow,
  decideAction,
  severityToStatus,
  isMoreSevere,
  MIN_SIGNALS,
  HEALTHY_WINDOWS_TO_RESOLVE,
  STALE_AFTER_MS,
} from '../src/lib/detection-policy.js';

const baseline = { p95_ms: 200 };
const win = (over = {}) => ({
  total_signals: 100,
  error_count: 0,
  unique_reporters: 10,
  p95_ms: 200,
  ...over,
});

describe('severityToStatus / isMoreSevere', () => {
  test('critical is down, major and minor are degraded', () => {
    assert.equal(severityToStatus('critical'), 'down');
    assert.equal(severityToStatus('major'), 'degraded');
    assert.equal(severityToStatus('minor'), 'degraded');
  });

  test('anything else is operational', () => {
    assert.equal(severityToStatus(null), 'operational');
    assert.equal(severityToStatus('resolved'), 'operational');
  });

  test('ranks severities', () => {
    assert.ok(isMoreSevere('critical', 'major'));
    assert.ok(isMoreSevere('major', 'minor'));
    assert.ok(isMoreSevere('minor', null));
    assert.ok(!isMoreSevere('minor', 'critical'));
    assert.ok(!isMoreSevere('major', 'major'));
  });
});

describe('classifyWindow — when we cannot judge', () => {
  test('a missing window is unknown, not healthy', () => {
    assert.equal(classifyWindow({}).verdict, 'unknown');
    assert.equal(classifyWindow({ window: null, baseline }).verdict, 'unknown');
  });

  test('too few signals is unknown', () => {
    const c = classifyWindow({ window: win({ total_signals: MIN_SIGNALS - 1 }), baseline });
    assert.equal(c.verdict, 'unknown');
    assert.match(c.reason, /signals/);
  });

  test('too few reporters is unknown even with plenty of signals', () => {
    const c = classifyWindow({ window: win({ unique_reporters: 4 }), baseline });
    assert.equal(c.verdict, 'unknown');
    assert.match(c.reason, /reporters/);
  });

  test('a broken API with too few reporters is never reported healthy', () => {
    const c = classifyWindow({ window: win({ unique_reporters: 4, error_count: 100 }), baseline });
    assert.equal(c.verdict, 'unknown', 'this is the "all systems operational during an outage" bug');
    assert.notEqual(c.verdict, 'healthy');
  });

  test('synthetic probes clear at a lower reporter count', () => {
    const w = win({ unique_reporters: 2, error_count: 60 });
    assert.equal(classifyWindow({ window: w, baseline }).verdict, 'unknown');
    assert.equal(classifyWindow({ window: w, baseline, syntheticOnly: true }).verdict, 'unhealthy');
  });
});

describe('classifyWindow — grading', () => {
  test('a clean window is healthy', () => {
    const c = classifyWindow({ window: win(), baseline });
    assert.equal(c.verdict, 'healthy');
    assert.equal(c.severity, null);
  });

  test('error-rate thresholds', () => {
    const at = rate => classifyWindow({ window: win({ error_count: rate }), baseline }).severity;
    assert.equal(at(60), 'critical');
    assert.equal(at(30), 'major');
    assert.equal(at(10), 'minor');
    assert.equal(at(5), null, '5% is on the boundary and not yet minor');
  });

  test('latency ratio raises severity when error rate does not', () => {
    assert.equal(classifyWindow({ window: win({ p95_ms: 500 }), baseline }).severity, 'minor');
    assert.equal(classifyWindow({ window: win({ p95_ms: 1200 }), baseline }).severity, 'major');
  });

  test('a missing p95 does not read as a latency spike', () => {
    const c = classifyWindow({ window: win({ p95_ms: null }), baseline });
    assert.equal(c.verdict, 'healthy');
    assert.equal(c.latencyRatio, null);
  });

  test('synthetic windows ignore latency entirely', () => {
    const c = classifyWindow({ window: win({ p95_ms: 99999 }), baseline, syntheticOnly: true });
    assert.equal(c.verdict, 'healthy', 'probe latency measures the worker network path, not users');
  });

  test('falls back to a default baseline of 200ms when none is given', () => {
    // 1200 / 200 = 6, past the 5x major threshold.
    assert.equal(classifyWindow({ window: win({ p95_ms: 1200 }), baseline: null }).severity, 'major');
    assert.equal(classifyWindow({ window: win({ p95_ms: 500 }), baseline: null }).severity, 'minor');
  });

  test('latency thresholds are exclusive at the boundary', () => {
    // Exactly 2x and exactly 5x do not cross; just past them do.
    assert.equal(classifyWindow({ window: win({ p95_ms: 400 }), baseline }).severity, null);
    assert.equal(classifyWindow({ window: win({ p95_ms: 401 }), baseline }).severity, 'minor');
    assert.equal(classifyWindow({ window: win({ p95_ms: 1000 }), baseline }).severity, 'minor');
    assert.equal(classifyWindow({ window: win({ p95_ms: 1001 }), baseline }).severity, 'major');
  });
});

describe('decideAction — opening and upgrading', () => {
  const unhealthy = sev => ({ verdict: 'unhealthy', severity: sev, reason: 'r' });

  test('opens an incident when an operational API goes unhealthy', () => {
    const d = decideAction({ classification: unhealthy('major'), currentStatus: 'operational' });
    assert.equal(d.action, 'open');
    assert.equal(d.severity, 'major');
  });

  test('does nothing when the incident is already open at that severity', () => {
    const d = decideAction({
      classification: unhealthy('major'), currentStatus: 'degraded', currentSeverity: 'major',
    });
    assert.equal(d.action, 'none');
  });

  test('upgrades when severity increases', () => {
    const d = decideAction({
      classification: unhealthy('critical'), currentStatus: 'degraded', currentSeverity: 'major',
    });
    assert.equal(d.action, 'upgrade');
    assert.equal(d.severity, 'critical');
  });

  test('never downgrades', () => {
    const d = decideAction({
      classification: unhealthy('minor'), currentStatus: 'down', currentSeverity: 'critical',
    });
    assert.equal(d.action, 'none');
  });

  test('going unhealthy clears any healthy streak', () => {
    const d = decideAction({
      classification: unhealthy('major'), currentStatus: 'operational',
      state: { consecutiveHealthy: 2 },
    });
    assert.equal(d.nextState.consecutiveHealthy, 0);
  });
});

describe('decideAction — resolving needs a streak', () => {
  const healthy = { verdict: 'healthy', severity: null, reason: 'ok' };

  test('one healthy window does not resolve an incident', () => {
    const d = decideAction({ classification: healthy, currentStatus: 'down' });
    assert.equal(d.action, 'none');
    assert.equal(d.nextState.consecutiveHealthy, 1);
  });

  test('resolves only after the required consecutive windows', () => {
    let state = {};
    let last;
    for (let i = 0; i < HEALTHY_WINDOWS_TO_RESOLVE; i++) {
      last = decideAction({ classification: healthy, currentStatus: 'down', state });
      state = last.nextState;
    }
    assert.equal(last.action, 'resolve');
    assert.match(last.reason, /consecutive/);
  });

  test('an unknown window in the middle breaks the streak', () => {
    let state = decideAction({ classification: healthy, currentStatus: 'down' }).nextState;
    state = decideAction({ classification: healthy, currentStatus: 'down', state }).nextState;
    assert.equal(state.consecutiveHealthy, 2);

    state = decideAction({
      classification: { verdict: 'unknown', reason: 'quiet' }, currentStatus: 'down', state,
    }).nextState;
    assert.equal(state.consecutiveHealthy, 0, 'a quiet window must not count toward resolving');

    const next = decideAction({ classification: healthy, currentStatus: 'down', state });
    assert.equal(next.action, 'none');
  });

  test('an operational API stays operational however long it is healthy', () => {
    let state = {};
    for (let i = 0; i < 10; i++) {
      const d = decideAction({ classification: healthy, currentStatus: 'operational', state });
      assert.equal(d.action, 'none');
      state = d.nextState;
    }
  });
});

describe('decideAction — quiet APIs', () => {
  const unknown = { verdict: 'unknown', severity: null, reason: 'only 2 signals' };

  test('never resolves an incident just because the data went quiet', () => {
    const d = decideAction({ classification: unknown, currentStatus: 'down' });
    assert.notEqual(d.action, 'resolve');
  });

  test('reports the incident stale once the quiet period is long enough', () => {
    const t0 = 1_000_000;
    let state = decideAction({ classification: unknown, currentStatus: 'down', now: t0 }).nextState;
    assert.equal(state.unknownSinceMs, t0);

    const soon = decideAction({ classification: unknown, currentStatus: 'down', state, now: t0 + 60_000 });
    assert.equal(soon.action, 'none');

    const later = decideAction({
      classification: unknown, currentStatus: 'down', state, now: t0 + STALE_AFTER_MS,
    });
    assert.equal(later.action, 'mark-stale');
    assert.match(later.reason, /2 signals/);
  });

  test('reports stale only once', () => {
    const t0 = 1_000_000;
    let state = { consecutiveHealthy: 0, unknownSinceMs: t0, staleReported: false };
    const first = decideAction({ classification: unknown, currentStatus: 'down', state, now: t0 + STALE_AFTER_MS });
    assert.equal(first.action, 'mark-stale');

    const second = decideAction({
      classification: unknown, currentStatus: 'down', state: first.nextState, now: t0 + STALE_AFTER_MS * 2,
    });
    assert.equal(second.action, 'none');
  });

  test('an operational API going quiet is never marked stale', () => {
    const t0 = 1_000_000;
    const state = { consecutiveHealthy: 0, unknownSinceMs: t0, staleReported: false };
    const d = decideAction({ classification: unknown, currentStatus: 'operational', state, now: t0 + STALE_AFTER_MS * 5 });
    assert.equal(d.action, 'none');
  });

  test('data returning healthy clears the quiet clock', () => {
    const t0 = 1_000_000;
    const state = { consecutiveHealthy: 0, unknownSinceMs: t0, staleReported: true };
    const d = decideAction({
      classification: { verdict: 'healthy', severity: null }, currentStatus: 'down', state, now: t0 + 1000,
    });
    assert.equal(d.nextState.unknownSinceMs, null);
    assert.equal(d.nextState.staleReported, false);
  });

  test('data returning unhealthy clears the quiet clock too', () => {
    const t0 = 1_000_000;
    const state = { consecutiveHealthy: 0, unknownSinceMs: t0, staleReported: true };
    const d = decideAction({
      classification: { verdict: 'unhealthy', severity: 'critical', reason: 'r' },
      currentStatus: 'degraded', currentSeverity: 'major', state, now: t0 + 1000,
    });
    assert.equal(d.action, 'upgrade');
    assert.equal(d.nextState.staleReported, false);
  });
});

describe('the two bugs this policy exists to prevent', () => {
  test('an outage with a thinning user base does not flip to operational', () => {
    // 100 signals but only 4 distinct reporters left, all erroring.
    const c = classifyWindow({ window: win({ unique_reporters: 4, error_count: 90 }), baseline });
    const d = decideAction({ classification: c, currentStatus: 'down', currentSeverity: 'critical' });
    assert.notEqual(d.action, 'resolve');
  });

  test('a recovered API does eventually resolve rather than sticking down', () => {
    let state = {};
    let action;
    for (let i = 0; i < HEALTHY_WINDOWS_TO_RESOLVE; i++) {
      const c = classifyWindow({ window: win(), baseline });
      const d = decideAction({ classification: c, currentStatus: 'down', currentSeverity: 'critical', state });
      action = d.action;
      state = d.nextState;
    }
    assert.equal(action, 'resolve');
  });
});
