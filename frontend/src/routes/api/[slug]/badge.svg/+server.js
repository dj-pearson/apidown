import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';

const STATUS_CONFIG = {
  operational: { label: 'operational', color: '#22c55e' },
  degraded:    { label: 'degraded',    color: '#f59e0b' },
  down:        { label: 'down',        color: '#ef4444' },
};

/**
 * GET /api/[slug]/badge.svg
 * Returns a shields.io-style SVG status badge for embedding in READMEs.
 */
export async function GET({ params, platform }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();

  const { data: api } = await supabase
    .from('apis')
    .select('name, current_status')
    .eq('slug', params.slug)
    .single();

  if (!api) {
    return new Response(generateBadge('unknown', 'not found', '#9ca3af'), {
      status: 404,
      headers: svgHeaders(60),
    });
  }

  const config = STATUS_CONFIG[api.current_status] || STATUS_CONFIG.operational;
  const svg = generateBadge(api.name, config.label, config.color);

  return new Response(svg, {
    status: 200,
    headers: svgHeaders(60),
  });
}

function svgHeaders(maxAge) {
  return {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
  };
}

function generateBadge(subject, status, color) {
  // Calculate widths based on text length (approximate)
  const subjectWidth = measureText(subject);
  const statusWidth = measureText(status);
  const totalWidth = subjectWidth + statusWidth;
  const subjectX = subjectWidth / 2;
  const statusX = subjectWidth + statusWidth / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${subject}: ${status}">
  <title>${subject}: ${status}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${subjectWidth}" height="20" fill="#555"/>
    <rect x="${subjectWidth}" width="${statusWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${subjectX * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${escapeXml(subject)}</text>
    <text x="${subjectX * 10}" y="140" transform="scale(.1)">${escapeXml(subject)}</text>
    <text aria-hidden="true" x="${statusX * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${escapeXml(status)}</text>
    <text x="${statusX * 10}" y="140" transform="scale(.1)">${escapeXml(status)}</text>
  </g>
</svg>`;
}

function measureText(text) {
  // Approximate character width for Verdana 11px
  return text.length * 6.5 + 12;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
