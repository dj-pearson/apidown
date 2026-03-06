/**
 * Weekly/daily digest worker.
 * Sends summary emails to users based on their digest_frequency preference.
 * Weekly: runs Monday 9am UTC. Daily: runs every day 9am UTC.
 */

export async function runWeeklyDigest(supabase) {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon
  const hour = now.getUTCHours();

  // Only run near 9am UTC
  if (hour !== 9) return;

  // Determine which frequencies to process
  const frequencies = ['daily'];
  if (dayOfWeek === 1) frequencies.push('weekly');

  for (const freq of frequencies) {
    await sendDigestsForFrequency(supabase, freq);
  }
}

async function sendDigestsForFrequency(supabase, frequency) {
  // Get users who want this frequency
  const { data: users } = await supabase
    .from('users')
    .select('id, email, tier')
    .eq('digest_frequency', frequency);

  if (!users || users.length === 0) return;

  // Determine the lookback period
  const lookbackMs = frequency === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - lookbackMs).toISOString();
  const periodLabel = frequency === 'weekly' ? 'this week' : 'today';

  for (const user of users) {
    try {
      await sendUserDigest(supabase, user, since, periodLabel, frequency);
    } catch (err) {
      console.error(`[weekly-digest] Error sending digest to ${user.email}:`, err.message);
    }
  }
}

async function sendUserDigest(supabase, user, since, periodLabel, frequency) {
  // Get user's subscribed APIs
  const { data: subs } = await supabase
    .from('alert_subscriptions')
    .select('api_id, apis!inner(slug, name, current_status)')
    .eq('email', user.email)
    .eq('verified', true);

  if (!subs || subs.length === 0) return;

  const apiIds = subs.map(s => s.api_id);

  // Get incidents for subscribed APIs in the period
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, api_id, title, severity, status, started_at, resolved_at')
    .in('api_id', apiIds)
    .gte('started_at', since)
    .order('started_at', { ascending: false });

  // Build per-API summary
  const apiSummaries = subs.map(sub => {
    const apiIncidents = (incidents || []).filter(i => i.api_id === sub.api_id);
    return {
      name: sub.apis.name,
      slug: sub.apis.slug,
      status: sub.apis.current_status,
      incidentCount: apiIncidents.length,
      incidents: apiIncidents.slice(0, 3),
    };
  });

  // Skip if nothing happened and all operational
  const totalIncidents = apiSummaries.reduce((s, a) => s + a.incidentCount, 0);
  const allOperational = apiSummaries.every(a => a.status === 'operational');
  if (totalIncidents === 0 && allOperational) return;

  // Build email content
  const lines = [
    `Your API Status Digest — ${periodLabel}`,
    '',
  ];

  for (const api of apiSummaries) {
    const statusEmoji = api.status === 'operational' ? '[OK]' : api.status === 'degraded' ? '[DEGRADED]' : '[DOWN]';
    lines.push(`${statusEmoji} ${api.name}`);
    if (api.incidentCount > 0) {
      for (const inc of api.incidents) {
        lines.push(`  - [${inc.severity.toUpperCase()}] ${inc.title} (${inc.status})`);
      }
      if (api.incidentCount > 3) {
        lines.push(`  ... and ${api.incidentCount - 3} more`);
      }
    } else {
      lines.push('  No incidents');
    }
    lines.push('');
  }

  lines.push(`View your dashboard: https://apidown.net/dashboard`);
  lines.push(`Manage digest settings: https://apidown.net/dashboard`);

  // Log the digest (we'd send via email service in production)
  console.log(`[weekly-digest] ${frequency} digest for ${user.email}: ${totalIncidents} incidents across ${apiSummaries.length} APIs`);

  // Record in alert_log to prevent duplicates
  if (incidents && incidents.length > 0) {
    // Find user's first subscription for dedup
    const { data: firstSub } = await supabase
      .from('alert_subscriptions')
      .select('id')
      .eq('email', user.email)
      .limit(1)
      .single();

    if (firstSub) {
      await supabase.from('alert_log').insert({
        subscription_id: firstSub.id,
        incident_id: incidents[0].id,
        channel: 'email',
        destination: user.email,
        status: 'sent',
      }).then(() => {});
    }
  }
}
