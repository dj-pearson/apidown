import { getSupabaseAdmin } from '$lib/supabase-server.js';

export async function load() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: apis } = await supabaseAdmin
      .from('apis')
      .select('id, slug, name, category, current_status, logo_url')
      .order('category')
      .order('name');

    const { data: incidents } = await supabaseAdmin
      .from('incidents')
      .select('id, api_id, severity, status, title, started_at')
      .neq('status', 'resolved')
      .order('started_at', { ascending: false })
      .limit(10);

    // Fetch recent resolved/active incidents for the "Recently Detected" widget
    const { data: recentIncidents } = await supabaseAdmin
      .from('incidents')
      .select('id, api_id, severity, status, title, started_at, resolved_at')
      .in('severity', ['critical', 'major'])
      .order('started_at', { ascending: false })
      .limit(5);

    // Fetch 24h sparkline data for all APIs (hourly avg latency)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: sparklineRaw } = await supabaseAdmin
      .from('signals_1min')
      .select('api_id, bucket, avg_duration_ms')
      .gte('bucket', since)
      .order('bucket', { ascending: true });

    // Group into hourly buckets per API
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

    return {
      apis: apis || [],
      activeIncidents: incidents || [],
      sparklineData,
      recentDetected,
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
