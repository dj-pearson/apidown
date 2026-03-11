import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { computeReliabilityScore, metricsFromRaw } from '$lib/reliability-score.js';

export async function load() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all independent queries in parallel for faster TTFB
    const [
      { data: apis },
      { data: incidents },
      { data: recentIncidents },
      { data: sparklineRaw },
      { data: allIncidents90d },
      { data: latency30d },
    ] = await Promise.all([
      supabaseAdmin
        .from('apis')
        .select('id, slug, name, category, current_status, logo_url')
        .order('category')
        .order('name'),
      supabaseAdmin
        .from('incidents')
        .select('id, api_id, severity, status, title, started_at')
        .neq('status', 'resolved')
        .order('started_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('incidents')
        .select('id, api_id, severity, status, title, started_at, resolved_at')
        .in('severity', ['critical', 'major'])
        .order('started_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('signals_1min')
        .select('api_id, bucket, avg_duration_ms')
        .gte('bucket', since)
        .order('bucket', { ascending: true }),
      supabaseAdmin
        .from('incidents')
        .select('api_id, started_at, resolved_at')
        .gte('started_at', ninetyDaysAgo),
      supabaseAdmin
        .from('signals_1min')
        .select('api_id, p95_ms')
        .gte('bucket', thirtyDaysAgo),
    ]);

    // Group sparkline data into hourly buckets per API
    const sparklines = {};
    for (const row of (sparklineRaw || [])) {
      if (!sparklines[row.api_id]) sparklines[row.api_id] = {};
      const hour = row.bucket.slice(0, 13);
      if (!sparklines[row.api_id][hour]) sparklines[row.api_id][hour] = [];
      sparklines[row.api_id][hour].push(row.avg_duration_ms);
    }

    // Compute hourly averages per API (array of up to 24 values)
    const sparklineData = {};
    for (const [apiId, hours] of Object.entries(sparklines)) {
      const sorted = Object.keys(hours).sort();
      sparklineData[apiId] = sorted.map(h => {
        const vals = hours[h];
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      });
    }

    // Build a lookup of api_id -> api name/slug for recent incidents
    const apiLookup = {};
    for (const api of (apis || [])) {
      apiLookup[api.id] = { name: api.name, slug: api.slug, logo_url: api.logo_url };
    }
    const recentDetected = (recentIncidents || []).map(inc => ({
      ...inc,
      api_name: apiLookup[inc.api_id]?.name || 'Unknown API',
      api_slug: apiLookup[inc.api_id]?.slug || '',
      api_logo: apiLookup[inc.api_id]?.logo_url || '',
    }));

    // Compute reliability grades for each API
    const gradeData = {};
    for (const api of (apis || [])) {
      const apiIncidents = (allIncidents90d || []).filter(i => i.api_id === api.id);
      const apiLatency = (latency30d || []).filter(l => l.api_id === api.id);

      // 30-day uptime
      let downMs = 0;
      const now = Date.now();
      const cutoff30 = now - 30 * 24 * 60 * 60 * 1000;
      for (const inc of apiIncidents) {
        const start = Math.max(new Date(inc.started_at).getTime(), cutoff30);
        const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;
        if (start < end && start >= cutoff30) downMs += end - start;
      }
      const uptimePct = ((1 - downMs / (30 * 24 * 60 * 60 * 1000)) * 100);

      const metrics = metricsFromRaw({ uptimePct, latencyData: apiLatency, incidents: apiIncidents });
      const { grade, gradeColor } = computeReliabilityScore(metrics);
      gradeData[api.id] = { grade, gradeColor };
    }

    return {
      apis: apis || [],
      activeIncidents: incidents || [],
      sparklineData,
      recentDetected,
      gradeData,
    };
  } catch (err) {
    console.error('Homepage load error:', err);
    return {
      apis: [],
      activeIncidents: [],
      sparklineData: {},
    };
  }
}
