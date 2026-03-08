import { getSupabaseAdmin, getEnv } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';
import { computeReliabilityScore, metricsFromRaw } from '$lib/reliability-score.js';

export async function load({ params, setHeaders }) {
  const supabase = getSupabaseAdmin();
  const { slug } = params;

  const { data: api } = await supabase
    .from('apis')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!api) throw error(404, 'API not found');

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const prevNinetyStart = new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString();

  // 30-day uptime
  const { data: uptimeIncidents } = await supabase
    .from('incidents')
    .select('started_at, resolved_at')
    .eq('api_id', api.id)
    .gte('started_at', thirtyDaysAgo);

  let downtimeMs = 0;
  for (const inc of (uptimeIncidents || [])) {
    const start = Math.max(new Date(inc.started_at).getTime(), now - 30 * 24 * 60 * 60 * 1000);
    const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;
    downtimeMs += Math.max(0, end - start);
  }
  const uptimePct = ((1 - downtimeMs / (30 * 24 * 60 * 60 * 1000)) * 100).toFixed(3);

  // 90-day incidents (current period)
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, severity, status, title, started_at, resolved_at')
    .eq('api_id', api.id)
    .gte('started_at', ninetyDaysAgo)
    .order('started_at', { ascending: false });

  // Previous 90-day incidents (for trend)
  const { data: prevIncidents } = await supabase
    .from('incidents')
    .select('started_at, resolved_at')
    .eq('api_id', api.id)
    .gte('started_at', prevNinetyStart)
    .lt('started_at', ninetyDaysAgo);

  // Recent latency data (30d)
  const { data: latencyData } = await supabase
    .from('signals_1min')
    .select('p50_ms, p95_ms')
    .eq('api_id', api.id)
    .gte('bucket', thirtyDaysAgo);

  // Previous period latency for trend
  const { data: prevLatencyData } = await supabase
    .from('signals_1min')
    .select('p50_ms, p95_ms')
    .eq('api_id', api.id)
    .gte('bucket', prevNinetyStart)
    .lt('bucket', ninetyDaysAgo);

  // Compute current score
  const metrics = metricsFromRaw({ uptimePct, latencyData, incidents });
  const currentScore = computeReliabilityScore(metrics);

  // Compute previous period score for trend
  let prevDowntimeMs = 0;
  for (const inc of (prevIncidents || [])) {
    const start = new Date(inc.started_at).getTime();
    const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : new Date(ninetyDaysAgo).getTime();
    prevDowntimeMs += Math.max(0, end - start);
  }
  const prevUptimePct = ((1 - prevDowntimeMs / (90 * 24 * 60 * 60 * 1000)) * 100).toFixed(3);
  const prevMetrics = metricsFromRaw({ uptimePct: prevUptimePct, latencyData: prevLatencyData, incidents: prevIncidents });
  const prevScore = computeReliabilityScore(prevMetrics);

  // Trend: improving, stable, degrading
  const scoreDelta = currentScore.score - prevScore.score;
  const trend = scoreDelta > 3 ? 'improving' : scoreDelta < -3 ? 'degrading' : 'stable';

  // Category peers for comparison
  const { data: peers } = await supabase
    .from('apis')
    .select('id, slug, name, logo_url, current_status')
    .eq('category', api.category)
    .neq('id', api.id)
    .is('owner_id', null)
    .order('name')
    .limit(5);

  setHeaders({ 'Cache-Control': 'public, max-age=300' });

  return {
    api,
    score: currentScore,
    metrics,
    trend,
    scoreDelta,
    prevScore: prevScore.score,
    incidents: (incidents || []).slice(0, 10),
    peers: peers || [],
  };
}
