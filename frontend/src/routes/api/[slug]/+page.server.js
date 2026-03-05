import { supabaseAdmin } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const { slug } = params;

  const { data: api } = await supabaseAdmin
    .from('apis')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!api) throw error(404, 'API not found');

  // Get recent incidents
  const { data: incidents } = await supabaseAdmin
    .from('incidents')
    .select('*')
    .eq('api_id', api.id)
    .order('started_at', { ascending: false })
    .limit(20);

  // Get 24h latency data from signals_1min
  const { data: latencyData } = await supabaseAdmin
    .from('signals_1min')
    .select('bucket, total_signals, error_count, avg_duration_ms, p50_ms, p95_ms, region')
    .eq('api_id', api.id)
    .gte('bucket', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('bucket', { ascending: true });

  // Calculate 90-day uptime
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: uptimeIncidents } = await supabaseAdmin
    .from('incidents')
    .select('started_at, resolved_at')
    .eq('api_id', api.id)
    .gte('started_at', ninetyDaysAgo);

  let downtimeMs = 0;
  for (const inc of (uptimeIncidents || [])) {
    const start = new Date(inc.started_at).getTime();
    const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now();
    downtimeMs += end - start;
  }
  const totalMs = 90 * 24 * 60 * 60 * 1000;
  const uptimePercent = ((1 - downtimeMs / totalMs) * 100).toFixed(3);

  return {
    api,
    incidents: incidents || [],
    latencyData: latencyData || [],
    uptimePercent,
  };
}
