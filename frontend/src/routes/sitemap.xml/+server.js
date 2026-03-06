import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';

export async function GET({ platform }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();
  const { data: apis } = await supabase
    .from('apis')
    .select('slug, updated_at, current_status')
    .order('name');

  const base = 'https://apidown.net';
  const now = new Date().toISOString();
  const staticPages = [
    { path: '/', freq: 'hourly', priority: '1.0' },
    { path: '/incidents', freq: 'hourly', priority: '0.8' },
    { path: '/docs', freq: 'weekly', priority: '0.7' },
    { path: '/pricing', freq: 'monthly', priority: '0.6' },
  ];

  const urls = [
    ...staticPages.map(p => `
    <url>
      <loc>${base}${p.path}</loc>
      <lastmod>${now}</lastmod>
      <changefreq>${p.freq}</changefreq>
      <priority>${p.priority}</priority>
    </url>`),
    ...(apis || []).map(a => {
      const lastmod = a.updated_at || now;
      // APIs with active issues get higher priority for crawl freshness
      const priority = a.current_status !== 'operational' ? '1.0' : '0.9';
      return `
    <url>
      <loc>${base}/api/${a.slug}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>hourly</changefreq>
      <priority>${priority}</priority>
    </url>`;
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
