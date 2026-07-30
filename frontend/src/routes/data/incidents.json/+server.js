import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { dataResponse, MAX_INCIDENT_ROWS } from '$lib/server/datasets.js';

/** GET /data/incidents.json — the full public incident dataset as JSON. */
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
        api_slug: api?.slug || null,
        api_name: api?.name || null,
        category: api?.category || null,
        severity: inc.severity,
        status: inc.status,
        title: inc.title,
        started_at: inc.started_at,
        resolved_at: inc.resolved_at || null,
        duration_minutes: end ? Math.round((end - start) / 60000) : null,
      };
    });

    const body = JSON.stringify({
      dataset: 'apidown-incidents',
      generated_at: new Date().toISOString(),
      row_limit: MAX_INCIDENT_ROWS,
      row_count: rows.length,
      attribution: 'APIdown.net — https://apidown.net/data',
      measurement_note: 'Incidents are detected from anonymised client-side signals, not vendor reporting.',
      rows,
    });

    return dataResponse(body, 'application/json; charset=utf-8', 'apidown-incidents.json');
  } catch (err) {
    console.error('[APIdown] incidents.json error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Dataset temporarily unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
