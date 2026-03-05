import { json } from '@sveltejs/kit';
import { getSupabaseAdmin } from '$lib/supabase-server.js';

export async function GET({ params }) {
  const supabaseAdmin = getSupabaseAdmin();
  const { slug } = params;

  const { data: api } = await supabaseAdmin
    .from('apis')
    .select('id, slug, name, category, current_status')
    .eq('slug', slug)
    .single();

  if (!api) {
    return json({ error: 'API not found' }, { status: 404 });
  }

  // 90-day uptime
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
  const uptime_90d = Number(((1 - downtimeMs / totalMs) * 100).toFixed(3));

  // Recent latency (last 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: latency } = await supabaseAdmin
    .from('signals_1min')
    .select('p50_ms, p95_ms, total_signals')
    .eq('api_id', api.id)
    .gte('bucket', oneHourAgo);

  let p50_ms = 0;
  let p95_ms = 0;
  if (latency && latency.length > 0) {
    const totalSignals = latency.reduce((s, d) => s + d.total_signals, 0);
    if (totalSignals > 0) {
      p50_ms = Math.round(latency.reduce((s, d) => s + d.p50_ms * d.total_signals, 0) / totalSignals);
      p95_ms = Math.round(latency.reduce((s, d) => s + d.p95_ms * d.total_signals, 0) / totalSignals);
    }
  }

  // Active incidents count
  const { count: active_incidents } = await supabaseAdmin
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .eq('api_id', api.id)
    .neq('status', 'resolved');

  return json({
    slug: api.slug,
    name: api.name,
    category: api.category,
    status: api.current_status,
    uptime_90d,
    p50_ms,
    p95_ms,
    active_incidents: active_incidents || 0,
    updated_at: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  });
}
