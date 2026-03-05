import { json } from '@sveltejs/kit';
import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';

/**
 * GET /api/[slug]/uptime.json
 * Returns daily uptime percentages for the last 90 days.
 */
export async function GET({ params, platform }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();

  const { data: api } = await supabase
    .from('apis')
    .select('id, slug, name')
    .eq('slug', params.slug)
    .single();

  if (!api) {
    return json({ error: 'API not found' }, { status: 404 });
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Fetch all incidents in the 90-day window
  const { data: incidents } = await supabase
    .from('incidents')
    .select('severity, started_at, resolved_at')
    .eq('api_id', api.id)
    .gte('started_at', ninetyDaysAgo.toISOString())
    .order('started_at', { ascending: true });

  // Build daily uptime map
  const days = [];
  const msPerDay = 24 * 60 * 60 * 1000;

  for (let i = 89; i >= 0; i--) {
    const dayStart = new Date(Date.now() - i * msPerDay);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + msPerDay);

    let downtimeMs = 0;
    let worstSeverity = null;

    for (const inc of (incidents || [])) {
      const incStart = new Date(inc.started_at).getTime();
      const incEnd = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now();

      // Calculate overlap with this day
      const overlapStart = Math.max(incStart, dayStart.getTime());
      const overlapEnd = Math.min(incEnd, dayEnd.getTime());

      if (overlapStart < overlapEnd) {
        downtimeMs += overlapEnd - overlapStart;
        const sevRank = { minor: 1, major: 2, critical: 3 };
        if (!worstSeverity || sevRank[inc.severity] > sevRank[worstSeverity]) {
          worstSeverity = inc.severity;
        }
      }
    }

    const uptimePct = Number(((1 - downtimeMs / msPerDay) * 100).toFixed(3));

    days.push({
      date: dayStart.toISOString().slice(0, 10),
      uptime_pct: uptimePct,
      downtime_minutes: Math.round(downtimeMs / 60000),
      worst_severity: worstSeverity,
    });
  }

  const overallUptime = days.length > 0
    ? Number((days.reduce((s, d) => s + d.uptime_pct, 0) / days.length).toFixed(3))
    : 100;

  return json({
    slug: api.slug,
    name: api.name,
    period: '90d',
    overall_uptime_pct: overallUptime,
    days,
    updated_at: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}
