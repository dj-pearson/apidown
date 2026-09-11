/**
 * The decision half of anomaly detection, kept pure so it can be tested.
 *
 * Two states are easy to confuse and must not be: an API that is *healthy*,
 * and an API we currently *cannot judge*. Treating the second as the first is
 * how a status page ends up claiming "all systems operational" during an
 * outage — the exact failure this product exists to catch. So a window with
 * too little data, or too few distinct reporters to clear the noise floor,
 * returns 'unknown' rather than 'healthy', and 'unknown' never resolves an
 * incident.
 *
 * The mirror-image failure is an incident that stays open forever because
 * traffic dried up and no window ever qualifies again. That is handled by
 * reporting the incident as stale rather than by quietly resolving it.
 */

/** A window below this many signals tells us nothing. */
export const MIN_SIGNALS = 5;

/** Distinct reporters needed before a verdict clears the noise floor. */
export const MIN_REPORTERS = 5;

/** Synthetic probes are few by nature, so they clear at a lower count. */
export const MIN_SYNTHETIC_REPORTERS = 2;

/** Consecutive healthy windows required before an incident is resolved. */
export const HEALTHY_WINDOWS_TO_RESOLVE = 3;

/** How long an open incident may go without judgeable data before it is stale. */
export const STALE_AFTER_MS = 30 * 60 * 1000;

const SEVERITY_RANK = { minor: 1, major: 2, critical: 3 };

/** 'down' for critical, 'degraded' for anything else actionable. */
export function severityToStatus(severity) {
  if (severity === 'critical') return 'down';
  if (severity === 'major' || severity === 'minor') return 'degraded';
  return 'operational';
}

export function isMoreSevere(next, current) {
  return (SEVERITY_RANK[next] || 0) > (SEVERITY_RANK[current] || 0);
}

/**
 * Read one 5-minute window against its 30-day baseline.
 *
 * Returns `{ verdict, severity, errorRate, latencyRatio, source, reason }`
 * where verdict is 'unknown' | 'healthy' | 'unhealthy'.
 */
export function classifyWindow({ window, baseline, syntheticOnly = false } = {}) {
  if (!window) {
    return unknown('no window data');
  }

  const totalSignals = window.total_signals || 0;
  if (totalSignals < MIN_SIGNALS) {
    return unknown(`only ${totalSignals} signals`);
  }

  const reporters = window.unique_reporters || 0;
  const minReporters = syntheticOnly ? MIN_SYNTHETIC_REPORTERS : MIN_REPORTERS;
  if (reporters < minReporters) {
    // Not healthy — just too few independent observers to say either way.
    return unknown(`only ${reporters} reporters (need ${minReporters})`);
  }

  const errorRate = totalSignals > 0 ? (window.error_count || 0) / totalSignals : 0;
  const baselineP95 = baseline?.p95_ms || 200;
  const windowP95 = window.p95_ms;
  // A missing p95 must not read as a latency spike.
  const latencyRatio = Number.isFinite(windowP95) && baselineP95 > 0
    ? windowP95 / baselineP95
    : null;

  const severity = gradeSeverity(errorRate, latencyRatio, syntheticOnly);
  const source = syntheticOnly ? 'synthetic' : (reporters > 0 ? 'hybrid' : 'sdk');

  return {
    verdict: severity ? 'unhealthy' : 'healthy',
    severity,
    errorRate,
    latencyRatio,
    source,
    reason: severity ? `error rate ${(errorRate * 100).toFixed(1)}%` : 'within baseline',
  };
}

function unknown(reason) {
  return { verdict: 'unknown', severity: null, errorRate: null, latencyRatio: null, source: null, reason };
}

function gradeSeverity(errorRate, latencyRatio, syntheticOnly) {
  if (syntheticOnly) {
    // Latency from a probe measures the network path from the worker, not a
    // user's experience, so only the error rate is trusted here.
    if (errorRate > 0.50) return 'critical';
    if (errorRate > 0.20) return 'major';
    if (errorRate > 0.10) return 'minor';
    return null;
  }

  if (errorRate > 0.50) return 'critical';
  if (errorRate > 0.20 || (latencyRatio !== null && latencyRatio > 5)) return 'major';
  if (errorRate > 0.05 || (latencyRatio !== null && latencyRatio > 2)) return 'minor';
  return null;
}

/**
 * Turn a classification plus the API's current state into one action.
 *
 * `state` is the detector's memory for this API:
 *   { consecutiveHealthy, unknownSinceMs, staleReported }
 *
 * Returns `{ action, severity, nextState, reason }` where action is one of
 * 'none' | 'open' | 'upgrade' | 'resolve' | 'mark-stale'.
 */
export function decideAction({
  classification,
  currentStatus,
  currentSeverity = null,
  state = {},
  now = Date.now(),
} = {}) {
  const { verdict, severity } = classification || {};
  const inIncident = currentStatus && currentStatus !== 'operational';
  const consecutiveHealthy = state.consecutiveHealthy || 0;
  const unknownSinceMs = state.unknownSinceMs ?? null;
  const staleReported = state.staleReported || false;

  if (verdict === 'unhealthy') {
    const nextState = { consecutiveHealthy: 0, unknownSinceMs: null, staleReported: false };
    if (!inIncident) {
      return { action: 'open', severity, nextState, reason: classification.reason };
    }
    if (isMoreSevere(severity, currentSeverity)) {
      return { action: 'upgrade', severity, nextState, reason: 'severity increased' };
    }
    return { action: 'none', severity, nextState, reason: 'incident already open' };
  }

  if (verdict === 'healthy') {
    const streak = consecutiveHealthy + 1;
    const nextState = { consecutiveHealthy: streak, unknownSinceMs: null, staleReported: false };
    if (inIncident && streak >= HEALTHY_WINDOWS_TO_RESOLVE) {
      return {
        action: 'resolve',
        severity: null,
        nextState: { consecutiveHealthy: 0, unknownSinceMs: null, staleReported: false },
        reason: `${streak} consecutive healthy windows`,
      };
    }
    return {
      action: 'none',
      severity: null,
      nextState,
      reason: inIncident ? `healthy ${streak}/${HEALTHY_WINDOWS_TO_RESOLVE}` : 'operational',
    };
  }

  // verdict === 'unknown': we cannot judge. Never resolve on this, and never
  // let the healthy streak carry over from before the data went quiet.
  const since = unknownSinceMs ?? now;
  const nextState = { consecutiveHealthy: 0, unknownSinceMs: since, staleReported };

  if (inIncident && !staleReported && now - since >= STALE_AFTER_MS) {
    return {
      action: 'mark-stale',
      severity: null,
      nextState: { ...nextState, staleReported: true },
      reason: classification?.reason || 'no judgeable data',
    };
  }

  return { action: 'none', severity: null, nextState, reason: classification?.reason || 'unknown' };
}
