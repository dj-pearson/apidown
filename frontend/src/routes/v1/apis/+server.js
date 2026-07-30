import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { v1Json, v1Error, v1Options, parsePaging, publicApi } from '$lib/server/v1.js';

export const OPTIONS = v1Options;

/** GET /v1/apis — list every tracked public API with its current status. */
export async function GET({ url, platform }) {
  setPlatform(platform);

  const { limit, offset } = parsePaging(url.searchParams, { defaultLimit: 100, maxLimit: 200 });
  const category = url.searchParams.get('category');
  const status = url.searchParams.get('status');

  if (status && !['operational', 'degraded', 'down'].includes(status)) {
    return v1Error('invalid_status', 'status must be one of: operational, degraded, down', 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('apis')
      .select('id, slug, name, category, current_status', { count: 'exact' })
      .is('owner_id', null)
      .order('name');
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('current_status', status);

    const { data: apis, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const rows = apis || [];
    const apiIds = rows.map(a => a.id);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ data: latency }, { data: openIncidents }] = await Promise.all([
      apiIds.length
        ? supabase
            .from('signals_1min')
            .select('api_id, p50_ms, p95_ms, total_signals')
            .in('api_id', apiIds)
            .gte('bucket', oneHourAgo)
        : Promise.resolve({ data: [] }),
      apiIds.length
        ? supabase
            .from('incidents')
            .select('api_id')
            .in('api_id', apiIds)
            .neq('status', 'resolved')
        : Promise.resolve({ data: [] }),
    ]);

    // Signal-weighted latency averages for the last hour.
    const agg = new Map();
    for (const row of latency || []) {
      const a = agg.get(row.api_id) || { signals: 0, p50: 0, p95: 0 };
      a.signals += row.total_signals || 0;
      a.p50 += (row.p50_ms || 0) * (row.total_signals || 0);
      a.p95 += (row.p95_ms || 0) * (row.total_signals || 0);
      agg.set(row.api_id, a);
    }

    const openCount = new Map();
    for (const inc of openIncidents || []) {
      openCount.set(inc.api_id, (openCount.get(inc.api_id) || 0) + 1);
    }

    const data = rows.map(api => {
      const a = agg.get(api.id);
      return publicApi(api, {
        p50_ms: a?.signals ? Math.round(a.p50 / a.signals) : null,
        p95_ms: a?.signals ? Math.round(a.p95 / a.signals) : null,
        open_incidents: openCount.get(api.id) || 0,
        url: `https://apidown.net/api/${api.slug}`,
      });
    });

    return v1Json(data, {
      meta: {
        total: count ?? data.length,
        limit,
        offset,
        summary: {
          operational: data.filter(a => a.status === 'operational').length,
          degraded: data.filter(a => a.status === 'degraded').length,
          down: data.filter(a => a.status === 'down').length,
        },
      },
    });
  } catch (err) {
    console.error('[APIdown] /v1/apis error:', err?.message || err);
    return v1Error('internal_error', 'Failed to load API list', 500);
  }
}
