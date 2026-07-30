import { getSupabaseAdmin } from '$lib/supabase-server.js';

const CATEGORY_LABELS = {
  payments: 'Payments',
  ai: 'AI / LLM',
  communications: 'Communications',
  'cloud-aws': 'Cloud — AWS',
  'cloud-gcp': 'Cloud — GCP',
  'cloud-azure': 'Cloud — Azure',
  auth: 'Auth & Identity',
  database: 'Database / Storage',
  devtools: 'Dev Tools & Hosting',
  commerce: 'Commerce & Shipping',
};

/**
 * Seeds the live radar with the last 48h of incident activity. Everything after
 * initial render arrives over Supabase realtime.
 */
export async function load({ url, setHeaders }) {
  setHeaders({ 'cache-control': 'public, max-age=15, s-maxage=30' });

  const category = url.searchParams.get('category');

  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    let apiQuery = supabase
      .from('apis')
      .select('id, slug, name, category, current_status, logo_url')
      .is('owner_id', null)
      .order('name');
    if (category) apiQuery = apiQuery.eq('category', category);

    const [{ data: apis }, { data: incidents }, { data: updates }] = await Promise.all([
      apiQuery,
      supabase
        .from('incidents')
        .select('id, api_id, severity, status, title, started_at, resolved_at')
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(150),
      supabase
        .from('incident_updates')
        .select('id, incident_id, message, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const apiList = apis || [];
    const apiIds = new Set(apiList.map(a => a.id));
    const apiById = {};
    for (const a of apiList) apiById[a.id] = a;

    const scoped = (incidents || []).filter(i => apiIds.has(i.api_id));
    const incidentById = {};
    for (const i of scoped) incidentById[i.id] = i;

    // Build one flat event stream: incident opened, incident resolved, update posted.
    const events = [];
    for (const inc of scoped) {
      const api = apiById[inc.api_id];
      events.push({
        key: `open-${inc.id}`,
        type: 'opened',
        at: inc.started_at,
        apiName: api.name,
        apiSlug: api.slug,
        severity: inc.severity,
        title: inc.title,
        incidentId: inc.id,
      });
      if (inc.resolved_at) {
        events.push({
          key: `resolved-${inc.id}`,
          type: 'resolved',
          at: inc.resolved_at,
          apiName: api.name,
          apiSlug: api.slug,
          severity: inc.severity,
          title: inc.title,
          incidentId: inc.id,
        });
      }
    }
    for (const u of updates || []) {
      const inc = incidentById[u.incident_id];
      if (!inc) continue;
      const api = apiById[inc.api_id];
      events.push({
        key: `update-${u.id}`,
        type: 'update',
        at: u.created_at,
        apiName: api.name,
        apiSlug: api.slug,
        severity: inc.severity,
        title: u.message,
        incidentId: inc.id,
      });
    }

    events.sort((a, b) => new Date(b.at) - new Date(a.at));

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

    return {
      events: events.slice(0, 200),
      apis: apiList,
      category,
      categoryLabel: category ? CATEGORY_LABELS[category] || category : null,
      categories: Object.entries(CATEGORY_LABELS).map(([slug, label]) => ({ slug, label })),
      openedLast24h: scoped.filter(i => new Date(i.started_at).getTime() >= dayAgo).length,
    };
  } catch (err) {
    console.error('[APIdown] Live radar load error:', err?.message || err);
    return {
      events: [],
      apis: [],
      category,
      categoryLabel: null,
      categories: Object.entries(CATEGORY_LABELS).map(([slug, label]) => ({ slug, label })),
      openedLast24h: 0,
    };
  }
}
