/**
 * Weekly/daily digest worker.
 * Sends summary emails to users based on their digest_frequency preference.
 * Weekly: runs Monday 9am UTC. Daily: runs every day 9am UTC.
 * Includes reliability scores and grade changes per API.
 *
 * Sends are idempotent per period: users.last_digest_period is stamped only
 * after a successful delivery, so a repeated run inside the same period skips
 * everyone already served, and a failed send is retried on the next run.
 */

import nodemailer from 'nodemailer';
import { computeReliabilityScore, computeMetricsFromData } from './reliability-score.js';

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://apidown.net';

let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return _transporter;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** ISO week key, so a weekly period key is stable across a run. */
function isoWeek(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** One key per user per delivery period. */
function periodKey(frequency, now = new Date()) {
  return frequency === 'weekly'
    ? `weekly-${isoWeek(now)}`
    : `daily-${now.toISOString().slice(0, 10)}`;
}

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
    await sendDigestsForFrequency(supabase, freq, periodKey(freq, now));
  }
}

async function sendDigestsForFrequency(supabase, frequency, period) {
  // Get users who want this frequency
  const { data: users } = await supabase
    .from('users')
    .select('id, email, tier, last_digest_period')
    .eq('digest_frequency', frequency);

  if (!users || users.length === 0) return;

  // Anyone already served this period is skipped, so a repeated run is a no-op.
  const pending = users.filter(u => u.last_digest_period !== period);
  if (pending.length === 0) return;

  // Determine the lookback period
  const lookbackMs = frequency === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - lookbackMs).toISOString();
  const periodLabel = frequency === 'weekly' ? 'this week' : 'today';

  // One user's failure must not abort the rest of the run.
  for (const user of pending) {
    try {
      await sendUserDigest(supabase, user, since, periodLabel, frequency, period);
    } catch (err) {
      console.error(`[weekly-digest] Error sending digest to user ${user.id}:`, err.message);
    }
  }
}

async function sendUserDigest(supabase, user, since, periodLabel, frequency, period) {
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
  lines.push(`View full report cards: ${SITE_URL}/dashboard`);
  lines.push(`Manage digest settings: ${SITE_URL}/dashboard`);

  const text = lines.join('\n');
  const subject = dropped.length > 0
    ? `[APIdown] Your ${frequency} digest — ${dropped.length} grade drop${dropped.length === 1 ? '' : 's'}`
    : `[APIdown] Your ${frequency} API digest`;

  await getTransporter().sendMail({
    from: process.env.ALERT_FROM_EMAIL || process.env.SMTP_FROM || 'alerts@apidown.net',
    to: user.email,
    subject,
    text,
    html: renderDigestHtml({ apiSummaries, dropped, periodLabel, totalIncidents }),
  });

  // Stamp only after a successful send, so a failure is retried next run rather
  // than silently skipped.
  await supabase
    .from('users')
    .update({ last_digest_period: period, last_digest_sent_at: new Date().toISOString() })
    .eq('id', user.id);

  console.log(`[weekly-digest] Sent ${frequency} digest to user ${user.id}: ${totalIncidents} incidents, ${apiSummaries.length} APIs, ${dropped.length} grade drops`);
}

/** HTML twin of the plain-text body above. Inline styles, no external assets. */
function renderDigestHtml({ apiSummaries, dropped, periodLabel, totalIncidents }) {
  const font = '-apple-system,Segoe UI,Helvetica,Arial,sans-serif';
  const statusColour = { operational: '#059669', degraded: '#d97706', down: '#dc2626' };

  const scoreRows = apiSummaries
    .filter(a => a.score)
    .map(a => {
      const arrow = a.score.direction === 'up' ? '↑' : a.score.direction === 'down' ? '↓' : '→';
      const changed = a.score.gradeChanged ? ` (was ${escapeHtml(a.score.prevGrade)})` : '';
      return `<tr>
        <td style="padding:5px 0;font:14px/1.45 ${font};color:#0f172a;">
          <strong>${escapeHtml(a.score.grade)}</strong> ${escapeHtml(a.name)}
        </td>
        <td align="right" style="padding:5px 0;font:13px/1.45 ${font};color:#64748b;">
          ${arrow} ${escapeHtml(a.score.uptimePct)}% (30d)${escapeHtml(changed)}
        </td>
      </tr>`;
    })
    .join('');

  const dropBlock = dropped.length
    ? `<tr><td style="padding:16px 24px 0;">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;">
          <strong style="font:600 14px/1.4 ${font};color:#991b1b;">Grade drops</strong>
          ${dropped.map(a => `<div style="font:13px/1.6 ${font};color:#7f1d1d;">${escapeHtml(a.name)}: ${escapeHtml(a.score.prevGrade)} → ${escapeHtml(a.score.grade)}</div>`).join('')}
        </div>
      </td></tr>`
    : '';

  const incidentBlocks = apiSummaries
    .map(a => {
      const colour = statusColour[a.status] || '#64748b';
      const items = a.incidentCount > 0
        ? a.incidents.map(inc => `<div style="font:13px/1.6 ${font};color:#475569;">• [${escapeHtml(inc.severity.toUpperCase())}] ${escapeHtml(inc.title)} (${escapeHtml(inc.status)})</div>`).join('') +
          (a.incidentCount > 3 ? `<div style="font:13px/1.6 ${font};color:#94a3b8;">… and ${a.incidentCount - 3} more</div>` : '')
        : `<div style="font:13px/1.6 ${font};color:#94a3b8;">No incidents</div>`;
      return `<div style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
        <div style="font:600 14px/1.4 ${font};color:${colour};">${escapeHtml(a.name)} — ${escapeHtml(a.status)}</div>
        ${items}
      </div>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Your ${escapeHtml(periodLabel)} API digest</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:24px 24px 0;">
        <h1 style="margin:0;font:700 19px/1.3 ${font};color:#0f172a;">Your API status digest</h1>
        <p style="margin:4px 0 0;font:13px/1.4 ${font};color:#64748b;">${escapeHtml(periodLabel)} · ${totalIncidents} incident${totalIncidents === 1 ? '' : 's'}</p>
      </td></tr>

      ${scoreRows ? `<tr><td style="padding:18px 24px 0;">
        <h2 style="margin:0 0 8px;font:600 15px/1.3 ${font};color:#0f172a;">Reliability scores</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${scoreRows}</table>
      </td></tr>` : ''}

      ${dropBlock}

      <tr><td style="padding:18px 24px 0;">
        <h2 style="margin:0 0 8px;font:600 15px/1.3 ${font};color:#0f172a;">Incidents</h2>
        ${incidentBlocks}
      </td></tr>

      <tr><td style="padding:20px 24px 24px;">
        <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#0891b2;color:#ffffff;font:600 14px/1 ${font};padding:11px 18px;border-radius:6px;text-decoration:none;">Open your dashboard</a>
        <p style="margin:14px 0 0;font:12px/1.6 ${font};color:#94a3b8;">
          Change how often you get this, or turn it off, in your
          <a href="${SITE_URL}/dashboard" style="color:#94a3b8;">digest settings</a>.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
