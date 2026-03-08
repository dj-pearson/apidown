import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function load({ params, setHeaders }) {
  const supabase = getSupabaseAdmin();
  const { id } = params;

  // Load the incident with API info
  const { data: incident } = await supabase
    .from('incidents')
    .select('*, apis!inner(id, slug, name, logo_url, category)')
    .eq('id', id)
    .single();

  if (!incident) throw error(404, 'Incident not found');

  // Load timeline updates
  const { data: updates } = await supabase
    .from('incident_updates')
    .select('id, status, message, created_at')
    .eq('incident_id', id)
    .order('created_at', { ascending: true });

  // Manual report count during incident
  const { count: reportCount } = await supabase
    .from('manual_reports')
    .select('*', { count: 'exact', head: true })
    .eq('api_id', incident.api_id)
    .gte('created_at', incident.started_at)
    .lte('created_at', incident.resolved_at || new Date().toISOString());

  // Calculate duration
  const startedAt = new Date(incident.started_at);
  const resolvedAt = incident.resolved_at ? new Date(incident.resolved_at) : null;
  const durationMs = resolvedAt ? resolvedAt.getTime() - startedAt.getTime() : Date.now() - startedAt.getTime();
  const durationMin = Math.round(durationMs / 60000);

  // Error rate during incident window from signals_1min
  const { data: signalsDuring } = await supabase
    .from('signals_1min')
    .select('total_signals, error_count, p50_ms, p95_ms, region')
    .eq('api_id', incident.api_id)
    .gte('bucket', incident.started_at)
    .lte('bucket', incident.resolved_at || new Date().toISOString());

  let totalSignals = 0;
  let totalErrors = 0;
  let peakP95 = 0;
  const affectedRegions = new Set();
  for (const s of (signalsDuring || [])) {
    totalSignals += s.total_signals || 0;
    totalErrors += s.error_count || 0;
    if (s.p95_ms > peakP95) peakP95 = Math.round(s.p95_ms);
    if (s.region) affectedRegions.add(s.region);
  }
  const errorRate = totalSignals > 0 ? ((totalErrors / totalSignals) * 100).toFixed(1) : '0.0';

  // Find correlated incidents (other APIs with incidents in overlapping ±15min window)
  const windowStart = new Date(startedAt.getTime() - 15 * 60000).toISOString();
  const windowEnd = (resolvedAt
    ? new Date(resolvedAt.getTime() + 15 * 60000)
    : new Date(Date.now() + 15 * 60000)
  ).toISOString();

  const { data: correlatedIncidents } = await supabase
    .from('incidents')
    .select('id, title, severity, status, started_at, resolved_at, apis!inner(name, slug)')
    .neq('id', id)
    .neq('api_id', incident.api_id)
    .or(`started_at.lte.${windowEnd},resolved_at.gte.${windowStart}`)
    .gte('started_at', windowStart)
    .lte('started_at', windowEnd)
    .order('started_at', { ascending: true })
    .limit(10);

  setHeaders({ 'Cache-Control': 'public, max-age=300' });

  return {
    incident,
    updates: updates || [],
    reportCount: reportCount || 0,
    duration: {
      ms: durationMs,
      minutes: durationMin,
      formatted: formatDuration(durationMs),
    },
    impact: {
      totalSignals,
      totalErrors,
      errorRate,
      peakP95,
      affectedRegions: [...affectedRegions],
    },
    correlatedIncidents: (correlatedIncidents || []).map(ci => ({
      id: ci.id,
      title: ci.title,
      severity: ci.severity,
      status: ci.status,
      apiName: ci.apis.name,
      apiSlug: ci.apis.slug,
      startedAt: ci.started_at,
      resolvedAt: ci.resolved_at,
    })),
  };
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
