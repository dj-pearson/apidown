import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { v1Json, v1Error, v1Options, publicIncident } from '$lib/server/v1.js';
import { monthlyBreakdown } from '$lib/api-history.js';

export const OPTIONS = v1Options;

const MAX_MONTHS = 24;

/** GET /v1/apis/:slug/history?months=12 — monthly uptime and incident rollup. */
export async function GET({ params, url, platform }) {
  setPlatform(platform);

  const rawMonths = Number(url.searchParams.get('months'));
  const months = Number.isFinite(rawMonths) && rawMonths > 0
    ? Math.min(Math.floor(rawMonths), MAX_MONTHS)
    : 12;

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

    // Fetch from the start of the oldest requested month so partially
    // overlapping incidents are attributed correctly.
    const d = new Date();
    const oldest = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (months - 1), 1)).toISOString();

    const { data: incidents } = await supabase
      .from('incidents')
      .select('id, severity, status, title, started_at, resolved_at')
      .eq('api_id', api.id)
      .or(`started_at.gte.${oldest},resolved_at.is.null`)
      .order('started_at', { ascending: false });

    const breakdown = monthlyBreakdown(incidents || [], months);

    return v1Json(
      {
        api: { slug: api.slug, name: api.name, category: api.category, status: api.current_status },
        months: breakdown.map(m => ({
          month: m.month,
          uptime_pct: m.uptimePct,
          incident_count: m.incidentCount,
          downtime_minutes: Math.round(m.downtimeMs / 60000),
          longest_outage_minutes: Math.round(m.longestOutageMs / 60000),
          url: `https://apidown.net/api/${api.slug}/history/${m.month}`,
          incidents: m.incidents.map(i => publicIncident(i, api.slug)),
        })),
      },
      { meta: { months, source: 'crowd-sourced client-side signals' }, maxAge: 300 },
    );
  } catch (err) {
    console.error('[APIdown] /v1/apis/[slug]/history error:', err?.message || err);
    return v1Error('internal_error', 'Failed to load API history', 500);
  }
}
