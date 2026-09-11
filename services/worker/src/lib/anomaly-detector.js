import {
  classifyWindow,
  decideAction,
  severityToStatus,
} from './detection-policy.js';

const ALERTS_QUEUE = 'alerts:pending';

let _redis = null;

/**
 * Per-API detector memory: how many consecutive healthy windows we have seen,
 * and since when the data stopped being judgeable. Held in the worker rather
 * than the database — it is a debounce, and starting fresh after a restart
 * only costs a few extra minutes before an incident resolves.
 */
const _state = new Map();

/** Exposed for tests and for the worker to clear on shutdown. */
export function resetDetectorState() {
  _state.clear();
}

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

  // A missing window is "we cannot judge", which is deliberately not the same
  // as "healthy" — the policy decides what to do about it.
  const window = (!wErr && windowData && windowData.length > 0) ? windowData[0] : null;

  const syntheticOnly = window ? await isSyntheticOnly(supabase, api.id) : false;

  let baseline = null;
  if (window) {
    const { data: baselineData, error: bErr } = await supabase
      .rpc('get_api_baseline', { p_api_id: api.id, p_days: 30 });
    if (!bErr && baselineData && baselineData.length > 0) baseline = baselineData[0];
  }

  const classification = classifyWindow({ window, baseline, syntheticOnly });

  const openIncident = api.current_status !== 'operational'
    ? await findOpenIncident(supabase, api.id)
    : null;

  const decision = decideAction({
    classification,
    currentStatus: api.current_status,
    currentSeverity: openIncident?.severity ?? null,
    state: _state.get(api.id),
  });
  _state.set(api.id, decision.nextState);

  switch (decision.action) {
    case 'open':
      await createIncident(supabase, api, decision.severity, window, classification.errorRate, classification.source);
      break;
    case 'upgrade':
      await upgradeIncident(supabase, api, openIncident, decision.severity);
      break;
    case 'resolve':
      await resolveIncident(supabase, api, decision.reason);
      break;
    case 'mark-stale':
      await markIncidentStale(supabase, api, openIncident, decision.reason);
      break;
    default:
      break;
  }
}

/** The most recent unresolved incident for an API, if any. */
async function findOpenIncident(supabase, apiId) {
  const { data } = await supabase
    .from('incidents')
    .select('id, severity')
    .eq('api_id', apiId)
    .neq('status', 'resolved')
    .order('started_at', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Say on the incident timeline that signals have dried up. Deliberately does
 * not resolve: an API nobody is calling any more is not an API we have
 * observed recovering, and silently clearing the incident would claim a
 * recovery that never happened.
 */
async function markIncidentStale(supabase, api, incident, reason) {
  if (!incident) return;
  await supabase.from('incident_updates').insert({
    incident_id: incident.id,
    status: 'monitoring',
    message: `Signal volume has dropped too low to confirm recovery (${reason}). This incident stays open until enough traffic returns to judge.`,
  });
  console.log(`[anomaly] STALE: ${api.slug} — ${reason}`);
}

/**
 * Check if all recent reporters for an API are synthetic probes.
 */
async function isSyntheticOnly(supabase, apiId) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('signals')
    .select('reporter_hash')
    .eq('api_id', apiId)
    .gt('time', fiveMinAgo)
    .not('reporter_hash', 'like', 'synth-%')
    .limit(1);

  if (error) return false;
  // If no non-synthetic reporters found, it's synthetic-only
  return !data || data.length === 0;
}

async function createIncident(supabase, api, severity, window, errorRate, source = 'sdk') {
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
      message: `Anomaly detected (${source}): ${(errorRate * 100).toFixed(1)}% error rate from ${window.total_signals} signals across ${(window.regions || []).length} region(s). Investigating.`,
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

  console.log(`[anomaly] INCIDENT CREATED: ${api.slug} → ${severity} (error rate: ${(errorRate * 100).toFixed(1)}%, source: ${source})`);
}

/** The policy has already decided this is an increase, so just apply it. */
async function upgradeIncident(supabase, api, incident, newSeverity) {
  if (!incident) return;

  await supabase
    .from('incidents')
    .update({ severity: newSeverity })
    .eq('id', incident.id);

  await supabase
    .from('apis')
    .update({ current_status: severityToStatus(newSeverity) })
    .eq('id', api.id);

  await supabase.from('incident_updates').insert({
    incident_id: incident.id,
    status: 'identified',
    message: `Severity upgraded from ${incident.severity} to ${newSeverity}.`,
  });

  console.log(`[anomaly] UPGRADED: ${api.slug} → ${newSeverity}`);
}

async function resolveIncident(supabase, api, reason = 'signals returned to normal') {
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
      message: `Signals have returned to normal (${reason}). Incident resolved.`,
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

  console.log(`[anomaly] RESOLVED: ${api.slug} → operational (${reason})`);
}
