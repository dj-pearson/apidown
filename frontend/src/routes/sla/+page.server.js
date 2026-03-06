import { getSupabaseAdmin, getEnv } from '$lib/supabase-server.js';
import { redirect } from '@sveltejs/kit';

export async function load({ cookies, platform }) {
  const { setPlatform } = await import('$lib/supabase-server.js');
  setPlatform(platform);

  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) throw redirect(303, '/login');

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
  if (authErr || !user) throw redirect(303, '/login');

  // Get user profile for tier check
  const { data: profile } = await supabase
    .from('users')
    .select('id, tier')
    .eq('id', user.id)
    .single();

  const tier = profile?.tier || 'free';
  if (tier === 'free') {
    return {
      requiresUpgrade: true,
      targets: [],
      pinnedApis: [],
      summary: { total: 0, passing: 0 },
    };
  }

  // Load user's SLA targets joined with apis
  const { data: targets } = await supabase
    .from('sla_targets')
    .select('id, api_id, uptime_target_pct, latency_p95_target_ms, apis!inner(slug, name, current_status, logo_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  // For each target, compute current month's actual uptime from incidents
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const totalMs = monthEnd.getTime() - monthStart.getTime();

  const enrichedTargets = [];
  for (const target of (targets || [])) {
    const { data: incidents } = await supabase
      .from('incidents')
      .select('started_at, resolved_at')
      .eq('api_id', target.api_id)
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

    const actualUptime = Number(((1 - downtimeMs / totalMs) * 100).toFixed(4));
    const uptimePassing = actualUptime >= Number(target.uptime_target_pct);

    enrichedTargets.push({
      id: target.id,
      api_id: target.api_id,
      api_name: target.apis.name,
      api_slug: target.apis.slug,
      uptime_target_pct: Number(target.uptime_target_pct),
      latency_p95_target_ms: target.latency_p95_target_ms,
      actual_uptime_pct: actualUptime,
      downtime_minutes: Math.round(downtimeMs / 60000),
      uptime_passing: uptimePassing,
      passing: uptimePassing, // overall pass/fail (could add latency check later)
    });
  }

  const passing = enrichedTargets.filter(t => t.passing).length;

  // Load pinned APIs for the "Add Target" form
  const { data: pinnedApis } = await supabase
    .from('pinned_apis')
    .select('api_id, apis!inner(slug, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  // Filter out APIs that already have targets
  const targetApiIds = new Set(enrichedTargets.map(t => t.api_id));
  const availableApis = (pinnedApis || [])
    .filter(p => !targetApiIds.has(p.api_id))
    .map(p => ({ api_id: p.api_id, name: p.apis.name }));

  return {
    requiresUpgrade: false,
    targets: enrichedTargets,
    availableApis,
    summary: { total: enrichedTargets.length, passing },
    month: monthStart.toISOString().slice(0, 7),
    ingestUrl: getEnv('PUBLIC_INGEST_URL') || getEnv('INGEST_URL') || 'https://ingest.apidown.net',
    supabaseUrl: getEnv('PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL'),
    supabaseAnonKey: getEnv('PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY'),
  };
}
