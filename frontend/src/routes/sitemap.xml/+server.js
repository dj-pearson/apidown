import { getSupabaseAdmin } from '$lib/supabase-server.js';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data: apis } = await supabase
    .from('apis')
    .select('slug')
    .order('name');

  const base = 'https://apidown.net';
  const staticPages = ['/', '/incidents', '/docs', '/pricing'];

  const urls = [
    ...staticPages.map(p => `
    <url>
      <loc>${base}${p}</loc>
      <changefreq>${p === '/' ? 'hourly' : 'daily'}</changefreq>
      <priority>${p === '/' ? '1.0' : '0.8'}</priority>
    </url>`),
    ...(apis || []).map(a => `
    <url>
      <loc>${base}/api/${a.slug}</loc>
      <changefreq>hourly</changefreq>
      <priority>0.9</priority>
    </url>`),
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
