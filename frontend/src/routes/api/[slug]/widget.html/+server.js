import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';

/**
 * GET /api/[slug]/widget.html
 * Returns a self-contained HTML widget showing live API status.
 * Embeddable via iframe. Supports ?theme=dark|light and ?color=hex.
 */
export async function GET({ params, url, platform }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();

  const { data: api } = await supabase
    .from('apis')
    .select('id, slug, name, current_status, logo_url')
    .eq('slug', params.slug)
    .single();

  if (!api) {
    return new Response('<html><body>API not found</body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // 24h uptime
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: incidents } = await supabase
    .from('incidents')
    .select('started_at, resolved_at')
    .eq('api_id', api.id)
    .gte('started_at', oneDayAgo);

  let downtimeMs = 0;
  for (const inc of (incidents || [])) {
    const start = Math.max(new Date(inc.started_at).getTime(), Date.now() - 24 * 60 * 60 * 1000);
    const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now();
    downtimeMs += Math.max(0, end - start);
  }
  const uptime24h = ((1 - downtimeMs / (24 * 60 * 60 * 1000)) * 100).toFixed(1);

  // Latest latency
  const { data: latency } = await supabase
    .from('signals_1min')
    .select('p50_ms, p95_ms')
    .eq('api_id', api.id)
    .order('bucket', { ascending: false })
    .limit(1);

  const p50 = latency?.[0]?.p50_ms ? Math.round(latency[0].p50_ms) : null;

  // Sparkline (24h hourly)
  const { data: sparkRaw } = await supabase
    .from('signals_1min')
    .select('bucket, avg_duration_ms')
    .eq('api_id', api.id)
    .gte('bucket', oneDayAgo)
    .order('bucket', { ascending: true });

  const hourBuckets = {};
  for (const r of (sparkRaw || [])) {
    const h = r.bucket.slice(0, 13);
    if (!hourBuckets[h]) hourBuckets[h] = [];
    hourBuckets[h].push(r.avg_duration_ms);
  }
  const sparkData = Object.values(hourBuckets).map(vs => Math.round(vs.reduce((a, b) => a + b, 0) / vs.length));

  // Theme and color
  const theme = url.searchParams.get('theme') === 'light' ? 'light' : 'dark';
  const accentRaw = url.searchParams.get('color') || '06b4d4';
  const accent = '#' + accentRaw.replace('#', '').replace(/[^a-fA-F0-9]/g, '').slice(0, 6);

  const statusConfig = {
    operational: { label: 'Operational', color: '#4ade80' },
    degraded: { label: 'Degraded', color: '#f59e0b' },
    down: { label: 'Down', color: '#ef4444' },
  };
  const st = statusConfig[api.current_status] || statusConfig.operational;

  // Build sparkline SVG path
  let sparkPath = '';
  if (sparkData.length > 1) {
    const max = Math.max(...sparkData) || 1;
    const min = Math.min(...sparkData);
    const range = max - min || 1;
    const w = 120;
    const h = 24;
    const step = w / (sparkData.length - 1);
    sparkPath = sparkData.map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (h - ((v - min) / range) * (h - 2) - 1).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }

  const bg = theme === 'light' ? '#ffffff' : '#1a1a2e';
  const fg = theme === 'light' ? '#1a1a2e' : '#e2e8f0';
  const muted = theme === 'light' ? '#64748b' : '#94a3b8';
  const border = theme === 'light' ? '#e2e8f0' : '#2d2d44';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(api.name)} Status — APIdown</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${bg};color:${fg};padding:12px;min-height:80px}
.w{border:1px solid ${border};border-radius:10px;padding:12px 14px;background:${bg}}
.hdr{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.logo{width:20px;height:20px;border-radius:4px}
.logo-ph{width:20px;height:20px;border-radius:4px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700}
.name{font-weight:600;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:${st.color}}
.dot{width:7px;height:7px;border-radius:50%;background:${st.color}}
.metrics{display:flex;gap:12px;align-items:center;margin-top:6px}
.metric{font-size:11px;color:${muted}}
.metric b{color:${fg};font-weight:600}
.spark{margin-left:auto}
.pby{text-align:right;margin-top:6px;font-size:9px}
.pby a{color:${muted};text-decoration:none;opacity:0.6}
.pby a:hover{opacity:1;color:${accent}}
</style>
</head>
<body>
<div class="w">
<div class="hdr">
${api.logo_url ? `<img src="${esc(api.logo_url)}" class="logo" alt=""/>` : `<div class="logo-ph">${esc(api.name[0])}</div>`}
<span class="name">${esc(api.name)}</span>
<div class="st"><span class="dot"></span>${esc(st.label)}</div>
</div>
<div class="metrics">
<span class="metric">Uptime 24h: <b>${uptime24h}%</b></span>
${p50 !== null ? `<span class="metric">Latency: <b>${p50}ms</b></span>` : ''}
${sparkPath ? `<svg class="spark" width="120" height="24" viewBox="0 0 120 24"><path d="${sparkPath}" fill="none" stroke="${accent}" stroke-width="1.5"/></svg>` : ''}
</div>
<div class="pby"><a href="https://apidown.net/api/${esc(api.slug)}" target="_blank" rel="noopener">Powered by APIdown.net</a></div>
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
