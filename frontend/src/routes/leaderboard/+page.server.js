import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { computeReliabilityScore, metricsFromRaw } from '$lib/reliability-score.js';

export async function load({ setHeaders }) {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Load all public APIs
  const { data: apis } = await supabase
    .from('apis')
    .select('id, slug, name, category, current_status, logo_url')
    .is('owner_id', null)
    .order('name');

  if (!apis || apis.length === 0) {
    return { categories: [], allRanked: [] };
  }

  const apiIds = apis.map(a => a.id);

  // Batch fetch incidents (90d)
  const { data: incidents90d } = await supabase
    .from('incidents')
    .select('api_id, started_at, resolved_at')
    .in('api_id', apiIds)
    .gte('started_at', ninetyDaysAgo);

  // Batch fetch latency (30d)
  const { data: latency30d } = await supabase
    .from('signals_1min')
    .select('api_id, p95_ms')
    .in('api_id', apiIds)
    .gte('bucket', thirtyDaysAgo);

  // Compute scores
  const ranked = apis.map(api => {
    const apiIncidents = (incidents90d || []).filter(i => i.api_id === api.id);
    const apiLatency = (latency30d || []).filter(l => l.api_id === api.id);

    // 30-day uptime
    let downMs = 0;
    const cutoff30 = now - 30 * 24 * 60 * 60 * 1000;
    for (const inc of apiIncidents) {
      const start = Math.max(new Date(inc.started_at).getTime(), cutoff30);
      const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;
      if (start < end && start >= cutoff30) downMs += end - start;
    }
    const uptimePct = (1 - downMs / (30 * 24 * 60 * 60 * 1000)) * 100;

    const metrics = metricsFromRaw({ uptimePct, latencyData: apiLatency, incidents: apiIncidents });
    const scoreResult = computeReliabilityScore(metrics);

    return {
      ...api,
      score: scoreResult.score,
      grade: scoreResult.grade,
      gradeColor: scoreResult.gradeColor,
      uptimePct: uptimePct.toFixed(3),
      incidentCount: apiIncidents.length,
      p95Ms: metrics.p95Ms,
    };
  });

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  // Group by category
  const categoryMap = {};
  for (const api of ranked) {
    const cat = api.category || 'Other';
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(api);
  }

  const categories = Object.entries(categoryMap)
    .map(([name, apis]) => ({ name, apis }))
    .sort((a, b) => a.name.localeCompare(b.name));

  setHeaders({ 'Cache-Control': 'public, max-age=300' });

  return { categories, allRanked: ranked };
}
