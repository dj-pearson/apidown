import { getSupabaseAdmin } from '$lib/supabase-server.js';

/**
 * My Stack loads the full public API list plus 24h sparklines and open
 * incidents. Filtering to the visitor's selection happens client-side so the
 * page can be rendered from localStorage without a round trip.
 */
export async function load({ setHeaders }) {
  setHeaders({ 'cache-control': 'public, max-age=30, s-maxage=60' });

  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: apis }, { data: openIncidents }, { data: sparklineRaw }] = await Promise.all([
      supabase
        .from('apis')
        .select('id, slug, name, category, current_status, logo_url')
        .is('owner_id', null)
        .order('name'),
      supabase
        .from('incidents')
        .select('id, api_id, severity, status, title, started_at')
        .neq('status', 'resolved')
        .order('started_at', { ascending: false }),
      supabase
        .from('signals_1min')
        .select('api_id, bucket, avg_duration_ms')
        .gte('bucket', since)
        .order('bucket', { ascending: true }),
    ]);

    // Hourly average per API for the sparklines (same shape as the homepage).
    const buckets = {};
    for (const row of sparklineRaw || []) {
      const hour = row.bucket.slice(0, 13);
      buckets[row.api_id] ??= {};
      buckets[row.api_id][hour] ??= [];
      buckets[row.api_id][hour].push(row.avg_duration_ms);
    }
    const sparklineData = {};
    for (const [apiId, hours] of Object.entries(buckets)) {
      sparklineData[apiId] = Object.keys(hours).sort().map(h => {
        const vals = hours[h];
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      });
    }

    return {
      apis: apis || [],
      openIncidents: openIncidents || [],
      sparklineData,
    };
  } catch (err) {
    console.error('[APIdown] Stack load error:', err?.message || err);
    return { apis: [], openIncidents: [], sparklineData: {} };
  }
}
