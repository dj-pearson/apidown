/**
 * Shared RSS 2.0 feed building for the global, per-API, and per-category feeds.
 */

export const SITE_URL = 'https://apidown.net';

export function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * @param {object} channel
 * @param {string} channel.title
 * @param {string} channel.link            Human-facing page for this feed
 * @param {string} channel.selfUrl         Canonical URL of the feed itself
 * @param {string} channel.description
 * @param {Array<{title:string,link:string,pubDate:Date|string,description:string,category?:string,guid?:string}>} items
 */
export function buildRss(channel, items) {
  const body = items
    .map(item => {
      const guid = item.guid || item.link;
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="${guid === item.link ? 'true' : 'false'}">${escapeXml(guid)}</guid>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>${item.category ? `\n      <category>${escapeXml(item.category)}</category>` : ''}
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml"/>
${body}
  </channel>
</rss>`;
}

export function rssResponse(xml, { maxAge = 300, status = 200 } = {}) {
  return new Response(xml, {
    status,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
    },
  });
}

/** Feed item for one incident row, given its API's name and slug. */
export function incidentItem(inc, apiName) {
  const link = `${SITE_URL}/incidents/${inc.id}`;
  const resolved = inc.resolved_at
    ? ` Resolved at ${new Date(inc.resolved_at).toUTCString()}.`
    : ' Still open.';
  return {
    title: `${apiName}: ${inc.title}`,
    link,
    pubDate: inc.started_at,
    description: `${apiName} — ${inc.severity} incident (${inc.status}).${resolved}`,
    category: inc.severity,
  };
}
