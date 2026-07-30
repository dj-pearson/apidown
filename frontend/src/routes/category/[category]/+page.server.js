import { error } from '@sveltejs/kit';
import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { computeReliabilityScore, metricsFromRaw } from '$lib/reliability-score.js';
import { uptimePctInWindow } from '$lib/api-history.js';
import { CATEGORY_META } from '$lib/categories.js';

/** Live latency + uptime ranking for every API in one category. */
export async function load({ params, setHeaders }) {
  const meta = CATEGORY_META[params.category];
  if (!meta) throw error(404, 'Unknown category');

  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=120' });

  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: apis } = await supabase
    .from('apis')
    .select('id, slug, name, current_status, logo_url')
    .eq('category', params.category)
    .is('owner_id', null)
    .order('name');

  const apiList = apis || [];
  if (apiList.length === 0) {
    return { category: params.category, ...meta, apis: [], generatedAt: new Date().toISOString() };
  }

  const apiIds = apiList.map(a => a.id);

  const [{ data: recentLatency }, { data: latency30d }, { data: incidents90d }] = await Promise.all([
    supabase
      .from('signals_1min')
      .select('api_id, p50_ms, p95_ms, total_signals, error_count')
      .in('api_id', apiIds)
      .gte('bucket', hourAgo),
    supabase
      .from('signals_1min')
      .select('api_id, p95_ms')
      .in('api_id', apiIds)
      .gte('bucket', thirtyDaysAgo),
    supabase
      .from('incidents')
      .select('api_id, started_at, resolved_at')
      .in('api_id', apiIds)
      .gte('started_at', ninetyDaysAgo),
  ]);

  // Signal-weighted latency for the last hour — the "right now" column.
  const live = new Map();
  for (const row of recentLatency || []) {
    const a = live.get(row.api_id) || { signals: 0, p50: 0, p95: 0, errors: 0 };
    const n = row.total_signals || 0;
    a.signals += n;
    a.p50 += (row.p50_ms || 0) * n;
    a.p95 += (row.p95_ms || 0) * n;
    a.errors += row.error_count || 0;
    live.set(row.api_id, a);
  }

  const ranked = apiList.map(api => {
    const l = live.get(api.id);
    const apiIncidents = (incidents90d || []).filter(i => i.api_id === api.id);
    const apiLatency30d = (latency30d || []).filter(r => r.api_id === api.id);
    const uptimePct = uptimePctInWindow(apiIncidents, now - 30 * 24 * 60 * 60 * 1000, now, now);

    const metrics = metricsFromRaw({
      uptimePct: uptimePct ?? 100,
      latencyData: apiLatency30d,
      incidents: apiIncidents,
    });
    const { grade, gradeColor } = computeReliabilityScore(metrics);

    return {
      slug: api.slug,
      name: api.name,
      logo_url: api.logo_url,
      status: api.current_status || 'operational',
      p50_ms: l?.signals ? Math.round(l.p50 / l.signals) : null,
      p95_ms: l?.signals ? Math.round(l.p95 / l.signals) : null,
      errorRate: l?.signals ? Math.round((l.errors / l.signals) * 10000) / 100 : null,
      signals: l?.signals || 0,
      uptimePct,
      incidentCount: apiIncidents.length,
      grade,
      gradeColor,
    };
  });

  // Default order: fastest measured p95 first, APIs with no signals last.
  ranked.sort((a, b) => {
    if (a.p95_ms === null && b.p95_ms === null) return a.name.localeCompare(b.name);
    if (a.p95_ms === null) return 1;
    if (b.p95_ms === null) return -1;
    return a.p95_ms - b.p95_ms;
  });

  return {
    category: params.category,
    ...meta,
    apis: ranked,
    generatedAt: new Date().toISOString(),
  };
}
