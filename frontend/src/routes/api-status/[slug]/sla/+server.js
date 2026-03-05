import { json } from '@sveltejs/kit';
import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';

export async function GET({ params, platform }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();
  const { slug } = params;

  const { data: api } = await supabase
    .from('apis')
    .select('id, slug, name')
    .eq('slug', slug)
    .single();

  if (!api) {
    return json({ error: 'API not found' }, { status: 404 });
  }

  // Monthly uptime for last 12 months
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const { data: incidents } = await supabase
      .from('incidents')
      .select('started_at, resolved_at')
      .eq('api_id', api.id)
      .gte('started_at', monthStart.toISOString())
      .lte('started_at', monthEnd.toISOString());

    let downtimeMs = 0;
    for (const inc of (incidents || [])) {
      const start = new Date(inc.started_at).getTime();
      const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now.getTime();
      const overlapStart = Math.max(start, monthStart.getTime());
      const overlapEnd = Math.min(end, monthEnd.getTime());
      if (overlapStart < overlapEnd) downtimeMs += overlapEnd - overlapStart;
    }

    const totalMs = monthEnd.getTime() - monthStart.getTime();
    months.push({
      month: monthStart.toISOString().slice(0, 7),
      uptime_pct: Number(((1 - downtimeMs / totalMs) * 100).toFixed(4)),
      downtime_minutes: Math.round(downtimeMs / 60000),
      incident_count: (incidents || []).length,
    });
  }

  return json({
    api: { slug: api.slug, name: api.name },
    report_generated: new Date().toISOString(),
    months,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
