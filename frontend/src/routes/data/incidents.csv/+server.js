import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { toCsv, dataResponse, MAX_INCIDENT_ROWS } from '$lib/server/datasets.js';

/** GET /data/incidents.csv — the full public incident dataset as CSV. */
export async function GET({ platform }) {
  setPlatform(platform);

  try {
    const supabase = getSupabaseAdmin();

    const { data: apis } = await supabase
      .from('apis')
      .select('id, slug, name, category')
      .is('owner_id', null);

    const apiList = apis || [];
    const byId = {};
    for (const a of apiList) byId[a.id] = a;

    const { data: incidents } = await supabase
      .from('incidents')
      .select('id, api_id, severity, status, title, started_at, resolved_at')
      .in('api_id', apiList.map(a => a.id))
      .order('started_at', { ascending: false })
      .limit(MAX_INCIDENT_ROWS);

    const rows = (incidents || []).map(inc => {
      const api = byId[inc.api_id];
      const start = new Date(inc.started_at).getTime();
      const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : null;
      return {
        incident_id: inc.id,
        api_slug: api?.slug || '',
        api_name: api?.name || '',
        category: api?.category || '',
        severity: inc.severity,
        status: inc.status,
        title: inc.title,
        started_at: inc.started_at,
        resolved_at: inc.resolved_at || '',
        duration_minutes: end ? Math.round((end - start) / 60000) : '',
      };
    });

    const csv = toCsv(
      ['incident_id', 'api_slug', 'api_name', 'category', 'severity', 'status', 'title', 'started_at', 'resolved_at', 'duration_minutes'],
      rows,
    );

    return dataResponse(csv, 'text/csv; charset=utf-8', 'apidown-incidents.csv');
  } catch (err) {
    console.error('[APIdown] incidents.csv error:', err?.message || err);
    return new Response('Dataset temporarily unavailable', { status: 500 });
  }
}
