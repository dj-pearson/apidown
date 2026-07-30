import { error } from '@sveltejs/kit';
import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { SITE_URL, buildRss, rssResponse, incidentItem } from '$lib/server/rss.js';

/** GET /api/[slug]/rss — incident feed for a single API. */
export async function GET({ params, platform }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();

  const { data: api } = await supabase
    .from('apis')
    .select('id, slug, name')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!api) throw error(404, 'API not found');

  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, title, severity, status, started_at, resolved_at')
    .eq('api_id', api.id)
    .order('started_at', { ascending: false })
    .limit(50);

  const xml = buildRss(
    {
      title: `APIdown.net — ${api.name} incidents`,
      link: `${SITE_URL}/api/${api.slug}`,
      selfUrl: `${SITE_URL}/api/${api.slug}/rss`,
      description: `Outages and degradations detected for the ${api.name} API, measured from real production traffic by APIdown.net`,
    },
    (incidents || []).map(inc => incidentItem(inc, api.name)),
  );

  return rssResponse(xml);
}
