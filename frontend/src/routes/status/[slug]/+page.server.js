import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function load({ params, platform, setHeaders }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();

  // Look up status page by slug
  const { data: page, error: pageErr } = await supabase
    .from('status_pages')
    .select('*')
    .eq('slug', params.slug)
    .single();

  // Fallback: check legacy user-based status pages
  if (pageErr || !page) {
    return loadLegacy(supabase, params, setHeaders);
  }

  if (!page.is_enabled) {
    throw error(404, 'This status page is not currently available');
  }

  // Load APIs for this status page
  const { data: pageApis } = await supabase
    .from('status_page_apis')
    .select('api_id, display_order, custom_label, apis!inner(id, slug, name, current_status, logo_url)')
    .eq('status_page_id', page.id)
    .order('display_order', { ascending: true });

  const apiIds = (pageApis || []).map(p => p.api_id);
  const apis = (pageApis || []).map(p => ({
    id: p.apis.id,
    slug: p.apis.slug,
    name: p.custom_label || p.apis.name,
    status: p.apis.current_status,
    logo_url: p.apis.logo_url,
  }));

  // Load uptime data (last N days) if enabled
  let uptimeData = {};
  if (page.show_uptime_bars && apiIds.length > 0) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - (page.uptime_days || 90));

    const { data: incidents } = await supabase
      .from('incidents')
      .select('api_id, started_at, resolved_at, severity')
      .in('api_id', apiIds)
      .gte('started_at', daysAgo.toISOString())
      .order('started_at', { ascending: true });

    // Build daily uptime map per API
    for (const apiId of apiIds) {
      const apiIncidents = (incidents || []).filter(i => i.api_id === apiId);
      uptimeData[apiId] = buildDailyUptime(apiIncidents, page.uptime_days || 90);
    }
  }

  // Load latency data (last 24h) if enabled
  let latencyData = {};
  if (page.show_latency_chart && apiIds.length > 0) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: signals } = await supabase
      .from('signals_1min')
      .select('api_id, bucket, p50_ms, p95_ms')
      .in('api_id', apiIds)
      .gte('bucket', oneDayAgo)
      .order('bucket', { ascending: true });

    // Group into hourly buckets per API
    for (const apiId of apiIds) {
      const apiSignals = (signals || []).filter(s => s.api_id === apiId);
      latencyData[apiId] = aggregateHourly(apiSignals);
    }
  }

  // Load recent incidents if enabled
  let recentIncidents = [];
  if (page.show_incidents && apiIds.length > 0) {
    const { data: incidents } = await supabase
      .from('incidents')
      .select('id, api_id, title, severity, status, started_at, resolved_at, apis!inner(name, slug)')
      .in('api_id', apiIds)
      .order('started_at', { ascending: false })
      .limit(page.incidents_count || 5);

    recentIncidents = (incidents || []).map(i => ({
      id: i.id,
      apiName: i.apis.name,
      apiSlug: i.apis.slug,
      title: i.title,
      severity: i.severity,
      status: i.status,
      startedAt: i.started_at,
      resolvedAt: i.resolved_at,
    }));
  }

  // Compute overall uptime percentage (30-day)
  let overallUptime = null;
  if (page.show_uptime_bars && apiIds.length > 0) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const totalMs = 30 * 24 * 60 * 60 * 1000;

    const { data: allIncidents } = await supabase
      .from('incidents')
      .select('api_id, started_at, resolved_at')
      .in('api_id', apiIds)
      .gte('started_at', thirtyDaysAgo.toISOString());

    let totalDowntime = 0;
    for (const inc of (allIncidents || [])) {
      const start = Math.max(new Date(inc.started_at).getTime(), thirtyDaysAgo.getTime());
      const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now();
      totalDowntime += Math.max(0, end - start);
    }
    // Average across all APIs
    const avgDowntime = apiIds.length > 0 ? totalDowntime / apiIds.length : 0;
    overallUptime = ((1 - avgDowntime / totalMs) * 100).toFixed(3);
  }

  // Subscriber count (for page owner info, not shown publicly)
  const { count: subscriberCount } = await supabase
    .from('status_page_subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('status_page_id', page.id);

  setHeaders({ 'Cache-Control': 'public, max-age=60' });

  return {
    page: {
      id: page.id,
      slug: page.slug,
      title: page.title,
      description: page.description,
      logoUrl: page.logo_url,
      accentColor: page.accent_color || '#06b4d4',
      showPoweredBy: page.show_powered_by,
      showUptimeBars: page.show_uptime_bars,
      showLatencyChart: page.show_latency_chart,
      showIncidents: page.show_incidents,
      showSubscriberForm: page.show_subscriber_form,
    },
    apis,
    uptimeData,
    latencyData,
    recentIncidents,
    overallUptime,
    subscriberCount: subscriberCount || 0,
  };
}

/** Fallback for legacy user-column status pages */
async function loadLegacy(supabase, params, setHeaders) {
  const { data: owner, error: userErr } = await supabase
    .from('users')
    .select('id, public_status_title, public_status_description, public_status_enabled, public_status_slug')
    .eq('public_status_slug', params.slug)
    .single();

  if (userErr || !owner) throw error(404, 'Status page not found');
  if (!owner.public_status_enabled) throw error(404, 'This status page is not currently available');

  const { data: pinnedApis } = await supabase
    .from('pinned_apis')
    .select('api_id, apis!inner(id, slug, name, current_status, logo_url)')
    .eq('user_id', owner.id)
    .order('created_at', { ascending: true });

  setHeaders({ 'Cache-Control': 'public, max-age=60' });

  return {
    page: {
      slug: owner.public_status_slug,
      title: owner.public_status_title || 'Status',
      description: owner.public_status_description || '',
      accentColor: '#06b4d4',
      showPoweredBy: true,
      showUptimeBars: false,
      showLatencyChart: false,
      showIncidents: false,
      showSubscriberForm: false,
    },
    apis: (pinnedApis || []).map(p => ({
      id: p.apis.id,
      slug: p.apis.slug,
      name: p.apis.name,
      status: p.apis.current_status,
      logo_url: p.apis.logo_url,
    })),
    uptimeData: {},
    latencyData: {},
    recentIncidents: [],
    overallUptime: null,
    subscriberCount: 0,
  };
}

/** Build daily uptime array from incidents */
function buildDailyUptime(incidents, days) {
  const result = [];
  const now = new Date();

  for (let d = days - 1; d >= 0; d--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const dayMs = dayEnd.getTime() - dayStart.getTime();

    let downtimeMs = 0;
    for (const inc of incidents) {
      const incStart = new Date(inc.started_at).getTime();
      const incEnd = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now();
      const overlapStart = Math.max(incStart, dayStart.getTime());
      const overlapEnd = Math.min(incEnd, dayEnd.getTime());
      if (overlapStart < overlapEnd) downtimeMs += overlapEnd - overlapStart;
    }

    const uptime = ((1 - downtimeMs / dayMs) * 100);
    result.push({
      date: dayStart.toISOString().slice(0, 10),
      uptime: Math.round(uptime * 100) / 100,
    });
  }
  return result;
}

/** Aggregate 1-min signals into hourly buckets */
function aggregateHourly(signals) {
  const buckets = {};
  for (const s of signals) {
    const hour = s.bucket.slice(0, 13); // YYYY-MM-DDTHH
    if (!buckets[hour]) buckets[hour] = { p50s: [], p95s: [] };
    if (s.p50_ms) buckets[hour].p50s.push(s.p50_ms);
    if (s.p95_ms) buckets[hour].p95s.push(s.p95_ms);
  }

  return Object.entries(buckets).map(([hour, data]) => ({
    hour,
    p50: Math.round(data.p50s.reduce((a, b) => a + b, 0) / data.p50s.length),
    p95: Math.round(data.p95s.reduce((a, b) => a + b, 0) / data.p95s.length),
  }));
}
