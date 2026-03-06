import { getSupabaseAdmin, getEnv } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function load({ params, cookies, url }) {
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

  // Determine latency range from URL param (default 24h)
  const VALID_RANGES = ['24h', '7d', '30d'];
  const rangeParam = url.searchParams.get('range') || '24h';
  const latencyRange = VALID_RANGES.includes(rangeParam) ? rangeParam : '24h';

  // Check user tier to enforce free-tier restriction
  // (userTier is resolved below, so we peek at it early here)
  let resolvedUserTier = null;
  const accessTokenEarly = cookies.get('sb-access-token');
  if (accessTokenEarly) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(accessTokenEarly);
      if (user) {
        const { data: profile } = await supabaseAdmin
          .from('users')
          .select('tier')
          .eq('id', user.id)
          .single();
        resolvedUserTier = profile?.tier || 'free';
      }
    } catch {
      // Not logged in or error
    }
  }

  // Free users can only see 24h
  const effectiveRange = (!resolvedUserTier || resolvedUserTier === 'free') ? '24h' : latencyRange;

  const rangeMs = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const cutoff = new Date(Date.now() - rangeMs[effectiveRange]).toISOString();

  // Get latency data from signals_1min
  const { data: rawLatencyData } = await supabaseAdmin
    .from('signals_1min')
    .select('bucket, total_signals, error_count, avg_duration_ms, p50_ms, p95_ms, region')
    .eq('api_id', api.id)
    .gte('bucket', cutoff)
    .order('bucket', { ascending: true });

  // For 7d/30d, bucket by hour to reduce data points
  let latencyData;
  if (effectiveRange === '24h') {
    latencyData = rawLatencyData || [];
  } else {
    const hourBuckets = new Map();
    for (const row of (rawLatencyData || [])) {
      const d = new Date(row.bucket);
      const hourKey = d.toISOString().slice(0, 13) + ':00:00.000Z';
      if (!hourBuckets.has(hourKey)) {
        hourBuckets.set(hourKey, { bucket: hourKey, p50_sum: 0, p95_sum: 0, avg_sum: 0, total_signals: 0, error_count: 0, count: 0, region: row.region });
      }
      const b = hourBuckets.get(hourKey);
      b.p50_sum += (row.p50_ms || 0) * (row.total_signals || 1);
      b.p95_sum += (row.p95_ms || 0) * (row.total_signals || 1);
      b.avg_sum += (row.avg_duration_ms || 0) * (row.total_signals || 1);
      b.total_signals += row.total_signals || 0;
      b.error_count += row.error_count || 0;
      b.count += row.total_signals || 1;
    }
    latencyData = Array.from(hourBuckets.values()).map(b => ({
      bucket: b.bucket,
      p50_ms: b.count > 0 ? b.p50_sum / b.count : 0,
      p95_ms: b.count > 0 ? b.p95_sum / b.count : 0,
      avg_duration_ms: b.count > 0 ? b.avg_sum / b.count : 0,
      total_signals: b.total_signals,
      error_count: b.error_count,
      region: b.region,
    }));
  }

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
  let userTier = resolvedUserTier;
  let isPinned = false;
  const accessToken = cookies.get('sb-access-token');
  if (accessToken) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken);
      if (user) {
        if (!userTier) {
          const { data: profile } = await supabaseAdmin
            .from('users')
            .select('tier')
            .eq('id', user.id)
            .single();
          userTier = profile?.tier || 'free';
        }

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
    latencyRange: effectiveRange,
    uptimePercent,
    dailyUptime,
    userTier,
    isPinned,
    maintenances: maintenances || [],
    ingestUrl: getEnv('PUBLIC_INGEST_URL') || getEnv('INGEST_URL') || 'https://ingest.apidown.net',
  };
}
