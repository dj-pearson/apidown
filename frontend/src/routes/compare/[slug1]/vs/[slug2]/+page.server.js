import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { error, redirect } from '@sveltejs/kit';
import { computeReliabilityScore, metricsFromRaw } from '$lib/reliability-score.js';
import { isCanonicalOrder, comparePath, peersForApi } from '$lib/compare-pairs.js';

export async function load({ params, setHeaders }) {
  // The comparison is symmetric, so both slug orders render the same page.
  // Send the non-canonical order to the one URL the sitemap and every internal
  // link point at, rather than serving duplicate content on two paths.
  if (!isCanonicalOrder(params.slug1, params.slug2)) {
    throw redirect(301, comparePath(params.slug1, params.slug2));
  }
  if (params.slug1 === params.slug2) {
    throw redirect(301, `/api/${params.slug1}`);
  }

  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Load both APIs
  const [res1, res2] = await Promise.all([
    supabase.from('apis').select('*').eq('slug', params.slug1).single(),
    supabase.from('apis').select('*').eq('slug', params.slug2).single(),
  ]);

  if (!res1.data) throw error(404, `API "${params.slug1}" not found`);
  if (!res2.data) throw error(404, `API "${params.slug2}" not found`);

  const apis = [res1.data, res2.data];
  const apiIds = apis.map(a => a.id);

  // Batch fetch data for both
  const [incRes, latRes] = await Promise.all([
    supabase.from('incidents').select('api_id, started_at, resolved_at, severity')
      .in('api_id', apiIds).gte('started_at', ninetyDaysAgo),
    supabase.from('signals_1min').select('api_id, p50_ms, p95_ms, region')
      .in('api_id', apiIds).gte('bucket', thirtyDaysAgo),
  ]);

  const results = apis.map(api => {
    const apiInc = (incRes.data || []).filter(i => i.api_id === api.id);
    const apiLat = (latRes.data || []).filter(l => l.api_id === api.id);

    // 30d uptime
    let downMs = 0;
    const cut30 = now - 30 * 24 * 60 * 60 * 1000;
    for (const inc of apiInc) {
      const s = Math.max(new Date(inc.started_at).getTime(), cut30);
      const e = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;
      if (s < e && s >= cut30) downMs += e - s;
    }
    const uptimePct = (1 - downMs / (30 * 24 * 60 * 60 * 1000)) * 100;

    const metrics = metricsFromRaw({ uptimePct, latencyData: apiLat, incidents: apiInc });
    const score = computeReliabilityScore(metrics);

    // P50 average
    const p50Vals = apiLat.filter(l => l.p50_ms > 0).map(l => l.p50_ms);
    const avgP50 = p50Vals.length > 0 ? Math.round(p50Vals.reduce((a, b) => a + b, 0) / p50Vals.length) : 0;

    // Regions
    const regions = [...new Set(apiLat.filter(l => l.region).map(l => l.region))];

    // Severity breakdown
    const sevCounts = { critical: 0, major: 0, minor: 0 };
    for (const inc of apiInc) {
      if (sevCounts[inc.severity] !== undefined) sevCounts[inc.severity]++;
    }

    return {
      api,
      score,
      metrics,
      uptimePct: uptimePct.toFixed(3),
      avgP50,
      regions,
      incidentCount: apiInc.length,
      sevCounts,
    };
  });

  // Same-category head-to-heads so a visitor (and a crawler) can walk from one
  // comparison to the next instead of hitting a dead end.
  const { data: categoryApis } = await supabase
    .from('apis')
    .select('slug, name, category, current_status, owner_id')
    .in('category', [...new Set(apis.map(a => a.category).filter(Boolean))])
    .is('owner_id', null)
    .order('name');

  const seen = new Set([comparePath(params.slug1, params.slug2)]);
  const related = [];
  for (const api of apis) {
    for (const peer of peersForApi(api.slug, categoryApis || [], 6)) {
      if (seen.has(peer.comparePath)) continue;
      seen.add(peer.comparePath);
      related.push({ path: peer.comparePath, from: api.name, to: peer.name });
      if (related.length >= 6) break;
    }
    if (related.length >= 6) break;
  }

  setHeaders({ 'Cache-Control': 'public, max-age=300' });

  return { comparisons: results, related };
}
