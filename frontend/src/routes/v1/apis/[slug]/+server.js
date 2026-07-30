import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { v1Json, v1Error, v1Options, publicApi, publicIncident } from '$lib/server/v1.js';
import { uptimePctInWindow } from '$lib/api-history.js';

export const OPTIONS = v1Options;

/** GET /v1/apis/:slug — current status, recent latency, uptime, open incidents. */
export async function GET({ params, platform }) {
  setPlatform(platform);

  try {
    const supabase = getSupabaseAdmin();

    const { data: api, error } = await supabase
      .from('apis')
      .select('id, slug, name, category, current_status')
      .eq('slug', params.slug)
      .is('owner_id', null)
      .maybeSingle();

    if (error) throw error;
    if (!api) return v1Error('not_found', `No tracked API with slug "${params.slug}"`, 404);

    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: latency }, { data: incidents30d }] = await Promise.all([
      supabase
        .from('signals_1min')
        .select('p50_ms, p95_ms, total_signals, error_count')
        .eq('api_id', api.id)
        .gte('bucket', dayAgo),
      supabase
        .from('incidents')
        .select('id, severity, status, title, started_at, resolved_at')
        .eq('api_id', api.id)
        .gte('started_at', thirtyDaysAgo)
        .order('started_at', { ascending: false }),
    ]);

    let signals = 0, p50 = 0, p95 = 0, errors = 0;
    for (const row of latency || []) {
      const n = row.total_signals || 0;
      signals += n;
      p50 += (row.p50_ms || 0) * n;
      p95 += (row.p95_ms || 0) * n;
      errors += row.error_count || 0;
    }

    const incidents = incidents30d || [];
    const open = incidents.filter(i => i.status !== 'resolved');

    return v1Json(
      publicApi(api, {
        url: `https://apidown.net/api/${api.slug}`,
        window_24h: {
          signals,
          p50_ms: signals ? Math.round(p50 / signals) : null,
          p95_ms: signals ? Math.round(p95 / signals) : null,
          error_rate: signals ? Math.round((errors / signals) * 10000) / 10000 : null,
          uptime_pct: uptimePctInWindow(incidents, now - 24 * 60 * 60 * 1000, now, now),
        },
        window_30d: {
          incident_count: incidents.length,
          uptime_pct: uptimePctInWindow(incidents, now - 30 * 24 * 60 * 60 * 1000, now, now),
        },
        open_incidents: open.map(i => publicIncident(i, api.slug)),
      }),
      { meta: { source: 'crowd-sourced client-side signals' }, maxAge: 30 },
    );
  } catch (err) {
    console.error('[APIdown] /v1/apis/[slug] error:', err?.message || err);
    return v1Error('internal_error', 'Failed to load API status', 500);
  }
}
