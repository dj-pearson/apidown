/**
 * Digest alert worker.
 * Runs every hour, sends batched alert digests to users who prefer digest mode.
 */

export async function runDigestAlerts(supabase) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Find digest subscribers with recent alerts
  const { data: digestSubs } = await supabase
    .from('alert_subscriptions')
    .select('id, api_id, channel, destination, apis!inner(slug, name, current_status)')
    .eq('alert_mode', 'digest')
    .eq('verified', true);

  if (!digestSubs || digestSubs.length === 0) return;

  // Find incidents that changed in the last hour
  const { data: recentIncidents } = await supabase
    .from('incidents')
    .select('id, api_id, title, severity, status, started_at')
    .gte('started_at', oneHourAgo)
    .order('started_at', { ascending: false });

  if (!recentIncidents || recentIncidents.length === 0) return;

  // Group incidents by api_id
  const incidentsByApi = {};
  for (const inc of recentIncidents) {
    if (!incidentsByApi[inc.api_id]) incidentsByApi[inc.api_id] = [];
    incidentsByApi[inc.api_id].push(inc);
  }

  // Send digest for each subscriber whose API had incidents
  for (const sub of digestSubs) {
    const apiIncidents = incidentsByApi[sub.api_id];
    if (!apiIncidents || apiIncidents.length === 0) continue;

    // Check if digest was already sent for this period
    const { data: recentAlerts } = await supabase
      .from('alert_log')
      .select('id')
      .eq('subscription_id', sub.id)
      .gte('sent_at', oneHourAgo)
      .limit(1);

    if (recentAlerts && recentAlerts.length > 0) continue;

    const subject = `[APIdown Digest] ${sub.apis.name}: ${apiIncidents.length} incident(s) in the last hour`;
    const body = apiIncidents
      .map(i => `- [${i.severity.toUpperCase()}] ${i.title} (${i.status})`)
      .join('\n');

    // Log the digest alert
    await supabase.from('alert_log').insert({
      subscription_id: sub.id,
      incident_id: apiIncidents[0].id,
      channel: sub.channel,
      destination: sub.destination,
      status: 'sent',
    });

    console.log(`[digest] Sent digest to ${sub.destination} for ${sub.apis.name}: ${apiIncidents.length} incidents`);
  }
}
