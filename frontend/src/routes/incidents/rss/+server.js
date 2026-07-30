import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { SITE_URL, buildRss, rssResponse, incidentItem } from '$lib/server/rss.js';

/** GET /incidents/rss — RSS 2.0 feed of recent incidents across every API. */
export async function GET({ platform }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();

  const { data: incidents, error } = await supabase
    .from('incidents')
    .select('id, title, severity, status, started_at, resolved_at, apis!inner(slug, name)')
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[APIdown] Incident feed error:', error.message);
    return new Response('Feed unavailable', { status: 500 });
  }

  const xml = buildRss(
    {
      title: 'APIdown.net — Incident Feed',
      link: `${SITE_URL}/incidents`,
      selfUrl: `${SITE_URL}/incidents/rss`,
      description:
        'Real-time incident feed for third-party API outages and degradations tracked by APIdown.net',
    },
    (incidents || []).map(inc => incidentItem(inc, inc.apis?.name || 'Unknown API')),
  );

  return rssResponse(xml);
}
