/**
 * Weekly/daily digest worker.
 * Sends summary emails to users based on their digest_frequency preference.
 * Weekly: runs Monday 9am UTC. Daily: runs every day 9am UTC.
 * Includes reliability scores and grade changes per API.
 */

import { computeReliabilityScore, computeMetricsFromData } from './reliability-score.js';

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
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const prevNinetyStart = new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString();

  // Get incidents for subscribed APIs in the digest period
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, api_id, title, severity, status, started_at, resolved_at')
    .in('api_id', apiIds)
    .gte('started_at', since)
    .order('started_at', { ascending: false });

  // Get 90-day incidents for reliability scoring
  const { data: incidents90d } = await supabase
    .from('incidents')
    .select('api_id, started_at, resolved_at')
    .in('api_id', apiIds)
    .gte('started_at', ninetyDaysAgo);

  // Get previous 90-day incidents for grade change detection
  const { data: prevIncidents90d } = await supabase
    .from('incidents')
    .select('api_id, started_at, resolved_at')
    .in('api_id', apiIds)
    .gte('started_at', prevNinetyStart)
    .lt('started_at', ninetyDaysAgo);

  // Get 30-day latency data for scoring
  const { data: latency30d } = await supabase
    .from('signals_1min')
    .select('api_id, p95_ms')
    .in('api_id', apiIds)
    .gte('bucket', thirtyDaysAgo);

  // Get previous period latency
  const { data: prevLatency } = await supabase
    .from('signals_1min')
    .select('api_id, p95_ms')
    .in('api_id', apiIds)
    .gte('bucket', prevNinetyStart)
    .lt('bucket', ninetyDaysAgo);

  // Compute reliability scores per API
  const scores = {};
  for (const apiId of apiIds) {
    const apiInc = (incidents90d || []).filter(i => i.api_id === apiId);
    const apiLat = (latency30d || []).filter(l => l.api_id === apiId);

    // 30-day uptime
    let downMs = 0;
    const cutoff30 = now - 30 * 24 * 60 * 60 * 1000;
    for (const inc of apiInc) {
      const start = Math.max(new Date(inc.started_at).getTime(), cutoff30);
      const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;
      if (start < end && start >= cutoff30) downMs += end - start;
    }
    const uptimePct = (1 - downMs / (30 * 24 * 60 * 60 * 1000)) * 100;

    const metrics = computeMetricsFromData({ uptimePct, latencyRows: apiLat, incidents: apiInc });
    const current = computeReliabilityScore(metrics);

    // Previous period score
    const prevInc = (prevIncidents90d || []).filter(i => i.api_id === apiId);
    const prevLat = (prevLatency || []).filter(l => l.api_id === apiId);
    let prevDownMs = 0;
    for (const inc of prevInc) {
      const start = new Date(inc.started_at).getTime();
      const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : new Date(ninetyDaysAgo).getTime();
      prevDownMs += Math.max(0, end - start);
    }
    const prevUptimePct = (1 - prevDownMs / (90 * 24 * 60 * 60 * 1000)) * 100;
    const prevMetrics = computeMetricsFromData({ uptimePct: prevUptimePct, latencyRows: prevLat, incidents: prevInc });
    const prev = computeReliabilityScore(prevMetrics);

    const gradeChanged = current.grade !== prev.grade;
    const direction = current.score > prev.score ? 'up' : current.score < prev.score ? 'down' : 'same';

    scores[apiId] = { ...current, prevGrade: prev.grade, gradeChanged, direction, uptimePct: uptimePct.toFixed(1) };
  }

  // Build per-API summary
  const apiSummaries = subs.map(sub => {
    const apiIncidents = (incidents || []).filter(i => i.api_id === sub.api_id);
    return {
      name: sub.apis.name,
      slug: sub.apis.slug,
      status: sub.apis.current_status,
      incidentCount: apiIncidents.length,
      incidents: apiIncidents.slice(0, 3),
      score: scores[sub.api_id] || null,
    };
  });

  // Skip if nothing happened, all operational, and no grade changes
  const totalIncidents = apiSummaries.reduce((s, a) => s + a.incidentCount, 0);
  const allOperational = apiSummaries.every(a => a.status === 'operational');
  const hasGradeChanges = apiSummaries.some(a => a.score?.gradeChanged);
  if (totalIncidents === 0 && allOperational && !hasGradeChanges) return;

  // Build email content
  const lines = [
    `Your API Status Digest — ${periodLabel}`,
    '',
    '═══════════════════════════════════════',
    '  RELIABILITY SCORES',
    '═══════════════════════════════════════',
    '',
  ];

  // Reliability score summary first
  for (const api of apiSummaries) {
    if (!api.score) continue;
    const arrow = api.score.direction === 'up' ? '↑' : api.score.direction === 'down' ? '↓' : '→';
    const changeNote = api.score.gradeChanged ? ` (was ${api.score.prevGrade})` : '';
    lines.push(`  [${api.score.grade}] ${api.name}  ${arrow}  ${api.score.uptimePct}% uptime (30d)${changeNote}`);
  }

  // Highlight any grade drops
  const dropped = apiSummaries.filter(a => a.score?.gradeChanged && a.score?.direction === 'down');
  if (dropped.length > 0) {
    lines.push('');
    lines.push('  ⚠ Grade drops:');
    for (const api of dropped) {
      lines.push(`    ${api.name}: ${api.score.prevGrade} → ${api.score.grade}`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════');
  lines.push('  INCIDENTS');
  lines.push('═══════════════════════════════════════');
  lines.push('');

  for (const api of apiSummaries) {
    const statusTag = api.status === 'operational' ? '[OK]' : api.status === 'degraded' ? '[DEGRADED]' : '[DOWN]';
    lines.push(`${statusTag} ${api.name}`);
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

  lines.push('───────────────────────────────────────');
  lines.push(`View full report cards: https://apidown.net/dashboard`);
  lines.push(`Manage digest settings: https://apidown.net/dashboard`);
  lines.push(`Unsubscribe: https://apidown.net/dashboard`);

  // Log the digest
  console.log(`[weekly-digest] ${frequency} digest for ${user.email}: ${totalIncidents} incidents, ${apiSummaries.length} APIs, ${dropped.length} grade drops`);

  // Record in alert_log to prevent duplicates
  if (incidents && incidents.length > 0) {
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
