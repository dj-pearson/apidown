import { getSupabaseAdmin, getEnv } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function load({ params, cookies }) {
  const supabaseAdmin = getSupabaseAdmin();
  const { slug } = params;

  const { data: api } = await supabaseAdmin
    .from('apis')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!api) throw error(404, 'API not found');

  // Get recent incidents
  const { data: incidents } = await supabaseAdmin
    .from('incidents')
    .select('*')
    .eq('api_id', api.id)
    .order('started_at', { ascending: false })
    .limit(20);

  // Get 24h latency data from signals_1min
  const { data: latencyData } = await supabaseAdmin
    .from('signals_1min')
    .select('bucket, total_signals, error_count, avg_duration_ms, p50_ms, p95_ms, region')
    .eq('api_id', api.id)
    .gte('bucket', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('bucket', { ascending: true });

  // Calculate 90-day uptime
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: uptimeIncidents } = await supabaseAdmin
    .from('incidents')
    .select('started_at, resolved_at')
    .eq('api_id', api.id)
    .gte('started_at', ninetyDaysAgo);

  let downtimeMs = 0;
  for (const inc of (uptimeIncidents || [])) {
    const start = new Date(inc.started_at).getTime();
    const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now();
    downtimeMs += end - start;
  }
  const totalMs = 90 * 24 * 60 * 60 * 1000;
  const uptimePercent = ((1 - downtimeMs / totalMs) * 100).toFixed(3);

  // Build 90-day daily uptime data from incidents
  const dailyUptime = [];
  const now = Date.now();
  for (let i = 89; i >= 0; i--) {
    const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    let dayDownMs = 0;
    for (const inc of (uptimeIncidents || [])) {
      const incStart = new Date(inc.started_at).getTime();
      const incEnd = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;
      const overlapStart = Math.max(incStart, dayStart.getTime());
      const overlapEnd = Math.min(incEnd, dayEnd.getTime());
      if (overlapStart < overlapEnd) dayDownMs += overlapEnd - overlapStart;
    }

    const dayTotalMs = 24 * 60 * 60 * 1000;
    const pct = ((1 - dayDownMs / dayTotalMs) * 100);
    dailyUptime.push({
      date: dayStart.toISOString().slice(0, 10),
      uptime: Math.round(pct * 100) / 100,
    });
  }

  // Fetch upcoming scheduled maintenances
  const { data: maintenances } = await supabaseAdmin
    .from('scheduled_maintenances')
    .select('title, description, scheduled_for, scheduled_until, status')
    .eq('api_id', api.id)
    .in('status', ['scheduled', 'in_progress'])
    .gte('scheduled_until', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(5);

  // Check if user is logged in and has this API pinned
  let userTier = null;
  let isPinned = false;
  const accessToken = cookies.get('sb-access-token');
  if (accessToken) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
      if (user) {
        const { data: profile } = await supabaseAdmin
          .from('users')
          .select('tier')
          .eq('id', user.id)
          .single();
        userTier = profile?.tier || 'free';

        const { data: pin } = await supabaseAdmin
          .from('pinned_apis')
          .select('id')
          .eq('user_id', user.id)
          .eq('api_id', api.id)
          .maybeSingle();
        isPinned = !!pin;
      }
    } catch {
      // Not logged in or error — that's fine
    }
  }

  return {
    api,
    incidents: incidents || [],
    latencyData: latencyData || [],
    uptimePercent,
    dailyUptime,
    userTier,
    isPinned,
    maintenances: maintenances || [],
    ingestUrl: getEnv('PUBLIC_INGEST_URL') || getEnv('INGEST_URL') || 'https://ingest.apidown.net',
  };
}
