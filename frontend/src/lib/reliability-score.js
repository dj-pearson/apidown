/**
 * Reliability Score Engine
 * Computes a letter grade (A+ to F) from API health metrics.
 *
 * Scoring weights:
 *   - Uptime (30d):     40%  — most critical
 *   - Latency P95:      25%  — user-perceived performance
 *   - Incident count:   20%  — stability signal
 *   - Avg resolution:   15%  — recovery speed
 */

/**
 * @param {object} metrics
 * @param {number} metrics.uptimePct      — 30-day uptime percentage (0-100)
 * @param {number} metrics.p95Ms          — Average P95 latency in ms
 * @param {number} metrics.incidentCount  — Number of incidents in 90 days
 * @param {number} metrics.avgResolutionMin — Average incident resolution time in minutes
 * @returns {{ score: number, grade: string, gradeColor: string, breakdown: object }}
 */
export function computeReliabilityScore(metrics) {
  const { uptimePct = 100, p95Ms = 0, incidentCount = 0, avgResolutionMin = 0 } = metrics;

  // Uptime score (0-100): 99.99% = 100, 99.9% = 90, 99% = 60, 95% = 20, <90% = 0
  const uptimeScore = uptimePct >= 99.99 ? 100
    : uptimePct >= 99.95 ? 95
    : uptimePct >= 99.9 ? 90
    : uptimePct >= 99.5 ? 80
    : uptimePct >= 99 ? 60
    : uptimePct >= 98 ? 40
    : uptimePct >= 95 ? 20
    : uptimePct >= 90 ? 10
    : 0;

  // Latency score (0-100): <100ms = 100, <200ms = 85, <500ms = 60, <1s = 40, <2s = 20, >2s = 0
  const latencyScore = p95Ms <= 0 ? 80 // no data, assume decent
    : p95Ms <= 100 ? 100
    : p95Ms <= 200 ? 85
    : p95Ms <= 500 ? 65
    : p95Ms <= 1000 ? 45
    : p95Ms <= 2000 ? 25
    : p95Ms <= 5000 ? 10
    : 0;

  // Incident score (0-100): 0 incidents = 100, 1 = 85, 2-3 = 65, 4-6 = 40, 7-10 = 20, >10 = 5
  const incidentScore = incidentCount === 0 ? 100
    : incidentCount === 1 ? 85
    : incidentCount <= 3 ? 65
    : incidentCount <= 6 ? 40
    : incidentCount <= 10 ? 20
    : 5;

  // Resolution score (0-100): <15min = 100, <30min = 85, <60min = 65, <2h = 45, <6h = 25, >6h = 10
  const resolutionScore = incidentCount === 0 ? 100 // no incidents = perfect
    : avgResolutionMin <= 15 ? 100
    : avgResolutionMin <= 30 ? 85
    : avgResolutionMin <= 60 ? 65
    : avgResolutionMin <= 120 ? 45
    : avgResolutionMin <= 360 ? 25
    : 10;

  // Weighted total
  const score = Math.round(
    uptimeScore * 0.40 +
    latencyScore * 0.25 +
    incidentScore * 0.20 +
    resolutionScore * 0.15
  );

  const { grade, gradeColor } = scoreToGrade(score);

  return {
    score,
    grade,
    gradeColor,
    breakdown: {
      uptime: { score: uptimeScore, weight: 40, value: uptimePct },
      latency: { score: latencyScore, weight: 25, value: p95Ms },
      incidents: { score: incidentScore, weight: 20, value: incidentCount },
      resolution: { score: resolutionScore, weight: 15, value: avgResolutionMin },
    },
  };
}

function scoreToGrade(score) {
  if (score >= 97) return { grade: 'A+', gradeColor: '#22c55e' };
  if (score >= 93) return { grade: 'A', gradeColor: '#22c55e' };
  if (score >= 90) return { grade: 'A-', gradeColor: '#4ade80' };
  if (score >= 87) return { grade: 'B+', gradeColor: '#4ade80' };
  if (score >= 83) return { grade: 'B', gradeColor: '#86efac' };
  if (score >= 80) return { grade: 'B-', gradeColor: '#86efac' };
  if (score >= 77) return { grade: 'C+', gradeColor: '#f59e0b' };
  if (score >= 73) return { grade: 'C', gradeColor: '#f59e0b' };
  if (score >= 70) return { grade: 'C-', gradeColor: '#fbbf24' };
  if (score >= 67) return { grade: 'D+', gradeColor: '#f97316' };
  if (score >= 63) return { grade: 'D', gradeColor: '#f97316' };
  if (score >= 60) return { grade: 'D-', gradeColor: '#fb923c' };
  return { grade: 'F', gradeColor: '#ef4444' };
}

/**
 * Compute metrics from raw data for score input.
 * @param {object} params
 * @param {number} params.uptimePct — 30-day uptime %
 * @param {Array} params.latencyData — array of { p95_ms } from signals_1min
 * @param {Array} params.incidents — array of { started_at, resolved_at } from last 90 days
 */
export function metricsFromRaw({ uptimePct, latencyData, incidents }) {
  // Average P95 from latency data
  const p95Values = (latencyData || []).filter(d => d.p95_ms > 0).map(d => d.p95_ms);
  const p95Ms = p95Values.length > 0
    ? Math.round(p95Values.reduce((a, b) => a + b, 0) / p95Values.length)
    : 0;

  // Incident count
  const incidentCount = (incidents || []).length;

  // Average resolution time
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
