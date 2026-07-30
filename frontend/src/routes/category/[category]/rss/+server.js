import { error } from '@sveltejs/kit';
import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { SITE_URL, buildRss, rssResponse, incidentItem } from '$lib/server/rss.js';
import { CATEGORY_META } from '$lib/categories.js';

/** GET /category/[category]/rss — incident feed for a whole category. */
export async function GET({ params, platform }) {
  setPlatform(platform);

  const meta = CATEGORY_META[params.category];
  if (!meta) throw error(404, 'Unknown category');

  const supabase = getSupabaseAdmin();

  const { data: apis } = await supabase
    .from('apis')
    .select('id, name')
    .eq('category', params.category)
    .is('owner_id', null);

  const apiList = apis || [];
  const nameById = {};
  for (const a of apiList) nameById[a.id] = a.name;

  let incidents = [];
  if (apiList.length > 0) {
    const { data } = await supabase
      .from('incidents')
      .select('id, api_id, title, severity, status, started_at, resolved_at')
      .in('api_id', apiList.map(a => a.id))
      .order('started_at', { ascending: false })
      .limit(50);
    incidents = data || [];
  }

  const xml = buildRss(
    {
      title: `APIdown.net — ${meta.label} incidents`,
      link: `${SITE_URL}/category/${params.category}`,
      selfUrl: `${SITE_URL}/category/${params.category}/rss`,
      description: `Outages and degradations across all ${meta.label} APIs tracked by APIdown.net, measured from real production traffic`,
    },
    incidents.map(inc => incidentItem(inc, nameById[inc.api_id] || 'Unknown API')),
  );

  return rssResponse(xml);
}
