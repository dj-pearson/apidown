import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';

/**
 * GET /status/[slug]/widget.html
 * Compact multi-API status widget for embedding in dashboards.
 * Supports ?theme=dark|light, ?color=hex, ?max=N
 */
export async function GET({ params, url, platform }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();

  // Load status page
  const { data: page } = await supabase
    .from('status_pages')
    .select('id, slug, title, is_enabled, accent_color')
    .eq('slug', params.slug)
    .single();

  if (!page || !page.is_enabled) {
    // Fallback: try legacy
    const { data: owner } = await supabase
      .from('users')
      .select('id, public_status_title, public_status_slug, public_status_enabled')
      .eq('public_status_slug', params.slug)
      .single();

    if (!owner || !owner.public_status_enabled) {
      return new Response('<html><body>Status page not found</body></html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Legacy: load pinned APIs
    const { data: pinned } = await supabase
      .from('pinned_apis')
      .select('apis!inner(slug, name, current_status)')
      .eq('user_id', owner.id)
      .order('created_at', { ascending: true });

    return renderWidget({
      title: owner.public_status_title || 'Status',
      slug: owner.public_status_slug,
      apis: (pinned || []).map(p => ({ name: p.apis.name, slug: p.apis.slug, status: p.apis.current_status })),
      accent: '#06b4d4',
    }, url);
  }

  // Load APIs for this status page
  const { data: pageApis } = await supabase
    .from('status_page_apis')
    .select('custom_label, apis!inner(slug, name, current_status)')
    .eq('status_page_id', page.id)
    .order('display_order', { ascending: true });

  const apis = (pageApis || []).map(p => ({
    name: p.custom_label || p.apis.name,
    slug: p.apis.slug,
    status: p.apis.current_status,
  }));

  return renderWidget({
    title: page.title,
    slug: page.slug,
    apis,
    accent: page.accent_color || '#06b4d4',
  }, url);
}

function renderWidget({ title, slug, apis, accent }, url) {
  const theme = url.searchParams.get('theme') === 'light' ? 'light' : 'dark';
  const maxApis = parseInt(url.searchParams.get('max') || '20', 10);
  const accentRaw = url.searchParams.get('color') || accent.replace('#', '');
  const accentColor = '#' + accentRaw.replace('#', '').replace(/[^a-fA-F0-9]/g, '').slice(0, 6);

  const displayApis = apis.slice(0, maxApis);
  const allOk = displayApis.length > 0 && displayApis.every(a => a.status === 'operational');
  const hasDown = displayApis.some(a => a.status === 'down');

  const bg = theme === 'light' ? '#ffffff' : '#1a1a2e';
  const fg = theme === 'light' ? '#1a1a2e' : '#e2e8f0';
  const muted = theme === 'light' ? '#64748b' : '#94a3b8';
  const border = theme === 'light' ? '#e2e8f0' : '#2d2d44';
  const surface = theme === 'light' ? '#f8fafc' : '#222240';

  const bannerBg = allOk ? 'rgba(74,222,128,0.12)' : hasDown ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)';
  const bannerColor = allOk ? '#4ade80' : hasDown ? '#ef4444' : '#f59e0b';
  const bannerText = allOk ? 'All Systems Operational' : hasDown ? 'Issues Detected' : 'Degraded Performance';

  const statusColors = { operational: '#4ade80', degraded: '#f59e0b', down: '#ef4444' };

  const apiRows = displayApis.map(a => {
    const c = statusColors[a.status] || statusColors.operational;
    const label = a.status === 'operational' ? 'Up' : a.status === 'degraded' ? 'Degraded' : 'Down';
    return `<div class="r"><span class="n">${esc(a.name)}</span><span class="s" style="color:${c}"><span class="d" style="background:${c}"></span>${label}</span></div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} Status</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${bg};color:${fg};padding:10px}
.w{border:1px solid ${border};border-radius:10px;overflow:hidden}
.hd{padding:10px 12px;font-size:12px;font-weight:700}
.bn{display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;font-size:11px;font-weight:600;background:${bannerBg};color:${bannerColor}}
.bn .bd{width:7px;height:7px;border-radius:50%;background:${bannerColor}}
.r{display:flex;align-items:center;justify-content:space-between;padding:7px 12px;border-top:1px solid ${border};font-size:12px}
.r:hover{background:${surface}}
.n{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.s{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;flex-shrink:0}
.d{width:6px;height:6px;border-radius:50%}
.ft{text-align:center;padding:8px;border-top:1px solid ${border}}
.ft a{color:${muted};font-size:9px;text-decoration:none;opacity:0.6}
.ft a:hover{opacity:1;color:${accentColor}}
</style>
</head>
<body>
<div class="w">
<div class="hd">${esc(title)}</div>
<div class="bn"><span class="bd"></span>${bannerText}</div>
${apiRows}
<div class="ft"><a href="https://apidown.net/status/${esc(slug)}" target="_blank" rel="noopener">View full status → Powered by APIdown.net</a></div>
</div>
<script>setTimeout(()=>location.reload(),60000)</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
