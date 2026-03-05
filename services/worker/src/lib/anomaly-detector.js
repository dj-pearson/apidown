const ALERTS_QUEUE = 'alerts:pending';

let _redis = null;

/**
 * Set the Redis client for alert queueing.
 */
export function setRedis(redis) {
  _redis = redis;
}

/**
 * Anomaly detection engine.
 * Runs every 60s, evaluates the last 5-minute window against 30-day baselines.
 */
export async function runAnomalyDetection(supabase) {
  const { data: apis, error } = await supabase
    .from('apis')
    .select('id, slug, name, current_status');

  if (error) {
    console.error('[anomaly] Failed to load APIs:', error.message);
    return;
  }

  for (const api of apis) {
    try {
      await evaluateApi(supabase, api);
    } catch (err) {
      console.error(`[anomaly] Error evaluating ${api.slug}:`, err.message);
    }
  }
}

async function evaluateApi(supabase, api) {
  // Get current 5-minute window metrics
  const { data: windowData, error: wErr } = await supabase
    .rpc('get_api_window', { p_api_id: api.id, p_minutes: 5 });

  if (wErr || !windowData || windowData.length === 0) return;
  const window = windowData[0];

  if (window.total_signals < 5) return; // Not enough data

  // Get 30-day baseline
  const { data: baselineData, error: bErr } = await supabase
    .rpc('get_api_baseline', { p_api_id: api.id, p_days: 30 });

  if (bErr || !baselineData || baselineData.length === 0) return;
  const baseline = baselineData[0];

  const errorRate = window.error_count / window.total_signals;
  const baselineP95 = baseline.p95_ms || 200;
  const latencyRatio = window.p95_ms / baselineP95;
  const uniqueReporters = window.unique_reporters || 0;

  const severity = getSeverity(errorRate, latencyRatio, uniqueReporters);

  if (severity && api.current_status === 'operational') {
    await createIncident(supabase, api, severity, window, errorRate);
  } else if (severity && api.current_status !== 'operational') {
    // Already in incident — check if severity needs upgrade
    await maybeUpgradeIncident(supabase, api, severity);
  } else if (!severity && api.current_status !== 'operational') {
    await resolveIncident(supabase, api);
  }
}

function getSeverity(errorRate, latencyRatio, reporters) {
  if (reporters < 5) return null;
  if (errorRate > 0.50) return 'critical';
  if (errorRate > 0.20 || latencyRatio > 5) return 'major';
  if (errorRate > 0.05 || latencyRatio > 2) return 'minor';
  return null;
}

function severityToStatus(severity) {
  if (severity === 'critical') return 'down';
  if (severity === 'major' || severity === 'minor') return 'degraded';
  return 'operational';
}

async function createIncident(supabase, api, severity, window, errorRate) {
  const newStatus = severityToStatus(severity);
  const title = `${api.name} - ${severity === 'critical' ? 'Major Outage' : 'Degraded Performance'} Detected`;

  // Create the incident
  const { data: incident, error: iErr } = await supabase
    .from('incidents')
    .insert({
      api_id: api.id,
      severity,
      title,
      regions: window.regions || [],
      auto_created: true,
    })
    .select('id')
    .single();

  if (iErr) {
    console.error(`[anomaly] Failed to create incident for ${api.slug}:`, iErr.message);
    return;
  }

  // Insert initial timeline entry
  if (incident) {
    await supabase.from('incident_updates').insert({
      incident_id: incident.id,
      status: 'investigating',
      message: `Anomaly detected: ${(errorRate * 100).toFixed(1)}% error rate from ${window.total_signals} signals across ${(window.regions || []).length} region(s). Investigating.`,
    });
  }

  // Update API status
  await supabase
    .from('apis')
    .update({ current_status: newStatus })
    .eq('id', api.id);

  // Queue alert jobs for subscribers
  if (_redis && incident) {
    await _redis.rpush(ALERTS_QUEUE, JSON.stringify({
      incident_id: incident.id,
      api_id: api.id,
      api_slug: api.slug,
      api_name: api.name,
      severity,
      title,
      regions: window.regions || [],
      event_type: 'incident',
    }));
  }

  console.log(`[anomaly] INCIDENT CREATED: ${api.slug} → ${severity} (error rate: ${(errorRate * 100).toFixed(1)}%)`);
}

async function maybeUpgradeIncident(supabase, api, newSeverity) {
  // Find the active incident
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, severity')
    .eq('api_id', api.id)
    .neq('status', 'resolved')
    .order('started_at', { ascending: false })
    .limit(1);

  if (!incidents || incidents.length === 0) return;

  const current = incidents[0];
  const severityRank = { minor: 1, major: 2, critical: 3 };

  if (severityRank[newSeverity] > severityRank[current.severity]) {
    await supabase
      .from('incidents')
      .update({ severity: newSeverity })
      .eq('id', current.id);

    const newStatus = severityToStatus(newSeverity);
    await supabase
      .from('apis')
      .update({ current_status: newStatus })
      .eq('id', api.id);

    // Insert timeline entry for upgrade
    await supabase.from('incident_updates').insert({
      incident_id: current.id,
      status: 'identified',
      message: `Severity upgraded from ${current.severity} to ${newSeverity}.`,
    });

    console.log(`[anomaly] UPGRADED: ${api.slug} → ${newSeverity}`);
  }
}

async function resolveIncident(supabase, api) {
  // Resolve active incidents for this API
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id')
    .eq('api_id', api.id)
    .neq('status', 'resolved');

  if (!incidents || incidents.length === 0) return;

  for (const incident of incidents) {
    await supabase
      .from('incidents')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', incident.id);

    // Insert resolution timeline entry
    await supabase.from('incident_updates').insert({
      incident_id: incident.id,
      status: 'resolved',
      message: 'All signals have returned to normal. Incident resolved.',
    });

    // Queue resolution alert
    if (_redis) {
      await _redis.rpush(ALERTS_QUEUE, JSON.stringify({
        incident_id: incident.id,
        api_id: api.id,
        api_slug: api.slug,
        api_name: api.name,
        severity: 'resolved',
        title: `${api.name} - Resolved`,
        regions: [],
        event_type: 'resolved',
      }));
    }
  }

  // Restore API status
  await supabase
    .from('apis')
    .update({ current_status: 'operational' })
    .eq('id', api.id);

  console.log(`[anomaly] RESOLVED: ${api.slug} → operational`);
}
