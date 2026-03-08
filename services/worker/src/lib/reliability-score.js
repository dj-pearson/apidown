/**
 * Reliability Score Engine (worker-side copy)
 * Computes a letter grade (A+ to F) from API health metrics.
 *
 * Weights: Uptime 40%, Latency P95 25%, Incidents 20%, Resolution 15%
 */

export function computeReliabilityScore({ uptimePct = 100, p95Ms = 0, incidentCount = 0, avgResolutionMin = 0 }) {
  const uptimeScore = uptimePct >= 99.99 ? 100
    : uptimePct >= 99.95 ? 95
    : uptimePct >= 99.9 ? 90
    : uptimePct >= 99.5 ? 80
    : uptimePct >= 99 ? 60
    : uptimePct >= 98 ? 40
    : uptimePct >= 95 ? 20
    : uptimePct >= 90 ? 10 : 0;

  const latencyScore = p95Ms <= 0 ? 80
    : p95Ms <= 100 ? 100
    : p95Ms <= 200 ? 85
    : p95Ms <= 500 ? 65
    : p95Ms <= 1000 ? 45
    : p95Ms <= 2000 ? 25
    : p95Ms <= 5000 ? 10 : 0;

  const incidentScore = incidentCount === 0 ? 100
    : incidentCount === 1 ? 85
    : incidentCount <= 3 ? 65
    : incidentCount <= 6 ? 40
    : incidentCount <= 10 ? 20 : 5;

  const resolutionScore = incidentCount === 0 ? 100
    : avgResolutionMin <= 15 ? 100
    : avgResolutionMin <= 30 ? 85
    : avgResolutionMin <= 60 ? 65
    : avgResolutionMin <= 120 ? 45
    : avgResolutionMin <= 360 ? 25 : 10;

  const score = Math.round(
    uptimeScore * 0.40 + latencyScore * 0.25 + incidentScore * 0.20 + resolutionScore * 0.15
  );

  const grade = score >= 97 ? 'A+' : score >= 93 ? 'A' : score >= 90 ? 'A-'
    : score >= 87 ? 'B+' : score >= 83 ? 'B' : score >= 80 ? 'B-'
    : score >= 77 ? 'C+' : score >= 73 ? 'C' : score >= 70 ? 'C-'
    : score >= 67 ? 'D+' : score >= 63 ? 'D' : score >= 60 ? 'D-' : 'F';

  return { score, grade };
}

/**
 * Compute metrics from raw Supabase data.
 */
export function computeMetricsFromData({ uptimePct, latencyRows, incidents }) {
  const p95Values = (latencyRows || []).filter(d => d.p95_ms > 0).map(d => d.p95_ms);
  const p95Ms = p95Values.length > 0
    ? Math.round(p95Values.reduce((a, b) => a + b, 0) / p95Values.length) : 0;

  const incidentCount = (incidents || []).length;

  let totalResMs = 0;
  let resolvedCount = 0;
  for (const inc of (incidents || [])) {
    if (inc.resolved_at) {
      totalResMs += new Date(inc.resolved_at).getTime() - new Date(inc.started_at).getTime();
      resolvedCount++;
    }
  }
  const avgResolutionMin = resolvedCount > 0 ? Math.round(totalResMs / resolvedCount / 60000) : 0;

  return { uptimePct: Number(uptimePct), p95Ms, incidentCount, avgResolutionMin };
}
