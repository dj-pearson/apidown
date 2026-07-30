import { error } from '@sveltejs/kit';
import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { monthlyBreakdown, uptimePctInWindow } from '$lib/api-history.js';

const MONTHS = 18;

/** Browsable incident archive for one API, grouped by month. */
export async function load({ params, setHeaders }) {
  setHeaders({ 'cache-control': 'public, max-age=300, s-maxage=600' });

  const supabase = getSupabaseAdmin();

  const { data: api } = await supabase
    .from('apis')
    .select('id, slug, name, category, current_status, logo_url')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!api) throw error(404, 'API not found');

  const d = new Date();
  const oldest = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (MONTHS - 1), 1)).toISOString();

  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, severity, status, title, started_at, resolved_at')
    .eq('api_id', api.id)
    .gte('started_at', oldest)
    .order('started_at', { ascending: false });

  const all = incidents || [];
  const months = monthlyBreakdown(all, MONTHS).map(m => ({
    month: m.month,
    label: m.label,
    incidentCount: m.incidentCount,
    downtimeMs: m.downtimeMs,
    uptimePct: m.uptimePct,
    longestOutageMs: m.longestOutageMs,
  }));

  const now = Date.now();

  return {
    api: { slug: api.slug, name: api.name, category: api.category, status: api.current_status, logo_url: api.logo_url },
    months,
    totalIncidents: all.length,
    uptime90d: uptimePctInWindow(all, now - 90 * 24 * 60 * 60 * 1000, now, now),
    windowMonths: MONTHS,
  };
}
