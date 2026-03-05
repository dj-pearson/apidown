import { getSupabaseAdmin } from '$lib/supabase-server.js';

const SITE_URL = 'https://apidown.net';

/**
 * GET /incidents/rss
 * Returns an RSS 2.0 feed of recent incidents.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: incidents, error } = await supabase
    .from('incidents')
    .select('id, title, severity, status, started_at, resolved_at, apis!inner(slug, name)')
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) {
    return new Response('Feed unavailable', { status: 500 });
  }

  const items = (incidents || []).map(inc => {
    const link = `${SITE_URL}/incidents/${inc.id}`;
    const pubDate = new Date(inc.started_at).toUTCString();
    const apiName = inc.apis?.name || 'Unknown API';
    const description = `${apiName} — ${inc.severity} incident (${inc.status})${inc.resolved_at ? '. Resolved at ' + new Date(inc.resolved_at).toUTCString() : ''}`;

    return `    <item>
      <title>${escapeXml(inc.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
      <category>${inc.severity}</category>
    </item>`;
  }).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>APIdown.net — Incident Feed</title>
    <link>${SITE_URL}/incidents</link>
    <description>Real-time incident feed for third-party API outages and degradations tracked by APIdown.net</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/incidents/rss" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
