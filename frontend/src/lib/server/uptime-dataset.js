import { monthlyBreakdown } from '$lib/api-history.js';
import { UPTIME_MONTHS } from './datasets.js';

/**
 * Builds the monthly uptime dataset shared by /data/uptime.csv and
 * /data/uptime.json: one row per API per month.
 */
export async function buildUptimeRows(supabase, months = UPTIME_MONTHS) {
  const { data: apis } = await supabase
    .from('apis')
    .select('id, slug, name, category')
    .is('owner_id', null)
    .order('name');

  const apiList = apis || [];
  if (apiList.length === 0) return [];

  const d = new Date();
  const oldest = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (months - 1), 1)).toISOString();

  const { data: incidents } = await supabase
    .from('incidents')
    .select('api_id, started_at, resolved_at')
    .in('api_id', apiList.map(a => a.id))
    .gte('started_at', oldest);

  const byApi = new Map();
  for (const inc of incidents || []) {
    if (!byApi.has(inc.api_id)) byApi.set(inc.api_id, []);
    byApi.get(inc.api_id).push(inc);
  }

  const rows = [];
  for (const api of apiList) {
    for (const m of monthlyBreakdown(byApi.get(api.id) || [], months)) {
      // Skip months with no elapsed time to measure (future months).
      if (m.uptimePct === null) continue;
      rows.push({
        api_slug: api.slug,
        api_name: api.name,
        category: api.category,
        month: m.month,
        uptime_pct: m.uptimePct,
        incident_count: m.incidentCount,
        downtime_minutes: Math.round(m.downtimeMs / 60000),
        longest_outage_minutes: Math.round(m.longestOutageMs / 60000),
      });
    }
  }
  return rows;
}

export const UPTIME_COLUMNS = [
  'api_slug',
  'api_name',
  'category',
  'month',
  'uptime_pct',
  'incident_count',
  'downtime_minutes',
  'longest_outage_minutes',
];
