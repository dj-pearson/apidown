import { json } from '@sveltejs/kit';
import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';

export async function GET({ platform }) {
  setPlatform(platform);
  const supabaseAdmin = getSupabaseAdmin();

  const { data: apis, error } = await supabaseAdmin
    .from('apis')
    .select('id, slug, name, category, current_status')
    .order('category')
    .order('name');

  if (error) {
    return json({ error: 'Failed to load API status' }, { status: 500 });
  }

  // Fetch recent latency data (last hour) for all APIs in one query
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: latencyData } = await supabaseAdmin
    .from('signals_1min')
    .select('api_id, p50_ms, p95_ms, total_signals, error_count')
    .gte('bucket', oneHourAgo);

  // Aggregate latency by api_id
  const latencyByApi = new Map();
  for (const row of (latencyData || [])) {
    if (!latencyByApi.has(row.api_id)) {
      latencyByApi.set(row.api_id, { totalSignals: 0, p50Sum: 0, p95Sum: 0, errors: 0 });
    }
    const agg = latencyByApi.get(row.api_id);
    agg.totalSignals += row.total_signals;
    agg.p50Sum += row.p50_ms * row.total_signals;
    agg.p95Sum += row.p95_ms * row.total_signals;
    agg.errors += row.error_count;
  }

  // Active incidents count per API
  const { data: activeIncidents } = await supabaseAdmin
    .from('incidents')
    .select('api_id')
    .neq('status', 'resolved');

  const incidentsByApi = new Map();
  for (const inc of (activeIncidents || [])) {
    incidentsByApi.set(inc.api_id, (incidentsByApi.get(inc.api_id) || 0) + 1);
  }

  const statuses = (apis || []).map(api => {
    const lat = latencyByApi.get(api.id);
    const p50_ms = lat && lat.totalSignals > 0 ? Math.round(lat.p50Sum / lat.totalSignals) : null;
    const p95_ms = lat && lat.totalSignals > 0 ? Math.round(lat.p95Sum / lat.totalSignals) : null;

    return {
      slug: api.slug,
      name: api.name,
      category: api.category,
      status: api.current_status,
      p50_ms,
      p95_ms,
      active_incidents: incidentsByApi.get(api.id) || 0,
    };
  });

  const summary = {
    operational: statuses.filter(a => a.status === 'operational').length,
    degraded: statuses.filter(a => a.status === 'degraded').length,
    down: statuses.filter(a => a.status === 'down').length,
  };

  return json({
    updated_at: new Date().toISOString(),
    count: statuses.length,
    summary,
    apis: statuses,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  });
}
