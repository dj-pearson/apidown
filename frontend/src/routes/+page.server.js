import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function load() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: apis, error: apisError } = await supabaseAdmin
    .from('apis')
    .select('id, slug, name, category, current_status, logo_url')
    .order('category')
    .order('name');

  if (apisError) throw error(500, apisError.message);

  const { data: incidents } = await supabaseAdmin
    .from('incidents')
    .select('id, api_id, severity, status, title, started_at')
    .neq('status', 'resolved')
    .order('started_at', { ascending: false })
    .limit(10);

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
    const hour = row.bucket.slice(0, 13); // "2026-03-05T17"
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

  return {
    apis: apis || [],
    activeIncidents: incidents || [],
    sparklineData,
  };
}
