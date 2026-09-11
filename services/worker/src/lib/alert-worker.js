import nodemailer from 'nodemailer';
import { sendPushForIncident } from './push-sender.js';
import { runDrain, passesThreshold } from './alert-queue.js';

const BATCH_SIZE = 50;

/** Guards against two drains overlapping if one runs longer than the interval. */
let _draining = false;

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

/**
 * Drains the alerts:pending queue and sends notifications.
 *
 * The queue mechanics live in alert-queue.js: a job is claimed onto a
 * processing list and only removed once delivered, so a crash mid-batch costs
 * a retry rather than the alerts.
 */
export async function drainAlerts(redis, supabase) {
  if (_draining) return;
  _draining = true;
  try {
    await runDrain(redis, {
      batchSize: BATCH_SIZE,
      processJob: job => processAlert(supabase, job),
    });
  } finally {
    _draining = false;
  }
}

/**
 * Work through every subscriber for one incident.
 * Returns an outcome per subscriber: 'sent', 'skipped' or 'failed'.
 */
async function processAlert(supabase, alertJob) {
  const { incident_id, api_slug, api_name, severity, title, event_type } = alertJob;
  const results = [];

  // Browser push first: it has its own subscriber table, so it must not be
  // skipped by the "no email/webhook subscribers" early return below.
  try {
    await sendPushForIncident({
      supabase,
      api: { id: alertJob.api_id, slug: api_slug, name: api_name },
      event: event_type === 'resolved' ? 'resolved' : 'opened',
      incident: { id: incident_id, severity, title },
    });
  } catch (err) {
    console.error('[alerts] Push notification error:', err.message);
  }

  // Get subscribers for this API (include threshold_config for filtering)
  const { data: subs, error } = await supabase
    .from('alert_subscriptions')
    .select('id, channel, destination, token, threshold_config')
    .eq('api_id', alertJob.api_id)
    .eq('verified', true);

  if (error) {
    // Could not read the subscriber list — the job is not finished with.
    console.error('[alerts] Failed to load subscribers:', error.message);
    return ['failed'];
  }
  if (!subs || subs.length === 0) return results;

  const senders = {
    email: sendEmailAlert,
    slack: sendSlackAlert,
    pagerduty: sendPagerDutyAlert,
    discord: sendDiscordAlert,
    teams: sendTeamsAlert,
    webhook: sendWebhookAlert,
  };

  for (const sub of subs) {
    if (!passesThreshold(sub, { severity, eventType: event_type })) {
      results.push('skipped');
      continue;
    }

    // alert_log is what makes a retry safe: a subscriber already delivered to
    // is skipped rather than told twice.
    const { data: existing, error: logErr } = await supabase
      .from('alert_log')
      .select('id')
      .eq('incident_id', incident_id)
      .eq('subscription_id', sub.id)
      .limit(1);

    if (logErr) {
      console.error('[alerts] Dedup lookup failed:', logErr.message);
      results.push('failed');
      continue;
    }
    if (existing && existing.length > 0) {
      results.push('skipped');
      continue;
    }

    const send = senders[sub.channel];
    if (!send) {
      console.error(`[alerts] No sender for channel "${sub.channel}"; skipping`);
      results.push('skipped');
      continue;
    }

    try {
      await send(sub, alertJob);
    } catch (err) {
      // Reported, not swallowed: the job is requeued and tried again.
      console.error(`[alerts] Failed to send ${sub.channel} alert for ${api_slug}:`, err.message);
      results.push('failed');
      continue;
    }

    const { error: insertErr } = await supabase
      .from('alert_log')
      .insert({ incident_id, subscription_id: sub.id });

    if (insertErr) {
      // Delivered but unrecorded. Do not retry the job on this alone — that
      // would send the alert again; the log entry is best effort.
      console.error('[alerts] Sent but failed to record in alert_log:', insertErr.message);
    }
    results.push('sent');
  }

  return results;
}

async function sendEmailAlert(sub, alertJob) {
  const { api_name, severity, title, regions, event_type } = alertJob;
  const isResolved = event_type === 'resolved';

  const subject = isResolved
    ? `[APIdown] ${api_name} - Resolved`
    : `[APIdown] ${api_name} - ${title}`;

  const text = isResolved
    ? `${api_name} is back to operational status.\n\nView live status: https://apidown.net/api/${alertJob.api_slug}\n\nUnsubscribe: https://apidown.net/unsubscribe?token=${sub.token}`
    : `${title}\n\nSeverity: ${severity}\nAffected Regions: ${(regions || []).join(', ') || 'Global'}\n\nView live status: https://apidown.net/api/${alertJob.api_slug}\nView incident: https://apidown.net/incidents/${alertJob.incident_id}\n\nUnsubscribe: https://apidown.net/unsubscribe?token=${sub.token}`;

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.ALERT_FROM_EMAIL || 'alerts@apidown.net',
    to: sub.destination,
    subject,
    text,
  });

  console.log(`[alerts] Email sent to ${sub.destination} for ${api_name}`);
}

async function sendSlackAlert(sub, alertJob) {
  const { api_name, severity, title, regions, event_type, api_slug } = alertJob;
  const isResolved = event_type === 'resolved';

  const emoji = isResolved ? ':white_check_mark:' : severity === 'critical' ? ':red_circle:' : ':warning:';

  const payload = {
    text: `${emoji} *${api_name}* - ${isResolved ? 'Resolved' : title}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: isResolved
            ? `${emoji} *${api_name}* is back to operational.`
            : `${emoji} *${api_name}* - ${title}\nSeverity: ${severity} | Regions: ${(regions || []).join(', ') || 'Global'}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Status' },
            url: `https://apidown.net/api/${api_slug}`,
          },
        ],
      },
    ],
  };

  await fetch(sub.destination, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`[alerts] Slack webhook sent for ${api_name}`);
}

async function sendPagerDutyAlert(sub, alertJob) {
  const { api_name, severity, title, event_type, api_slug, incident_id } = alertJob;
  const isResolved = event_type === 'resolved';

  const pdSeverity = severity === 'critical' ? 'critical' : severity === 'major' ? 'error' : 'warning';

  const payload = {
    routing_key: sub.destination,
    event_action: isResolved ? 'resolve' : 'trigger',
    dedup_key: `apidown-${incident_id}`,
    payload: {
      summary: isResolved ? `${api_name} - Resolved` : title,
      severity: pdSeverity,
      source: 'apidown.net',
      component: api_name,
      custom_details: {
        status_page: `https://apidown.net/api/${api_slug}`,
        incident: `https://apidown.net/incidents/${incident_id}`,
      },
    },
    links: [
      { href: `https://apidown.net/api/${api_slug}`, text: 'View Status' },
    ],
  };

  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`[alerts] PagerDuty event sent for ${api_name}`);
}

async function sendDiscordAlert(sub, alertJob) {
  const { api_name, severity, title, regions, event_type, api_slug } = alertJob;
  const isResolved = event_type === 'resolved';

  const color = isResolved ? 0x22c55e : severity === 'critical' ? 0xef4444 : severity === 'major' ? 0xf97316 : 0xeab308;

  const payload = {
    embeds: [{
      title: isResolved ? `${api_name} - Resolved` : title,
      description: isResolved
        ? `${api_name} is back to operational status.`
        : `Severity: **${severity}**\nRegions: ${(regions || []).join(', ') || 'Global'}`,
      color,
      url: `https://apidown.net/api/${api_slug}`,
      footer: { text: 'APIdown.net' },
      timestamp: new Date().toISOString(),
    }],
  };

  await fetch(sub.destination, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`[alerts] Discord webhook sent for ${api_name}`);
}

async function sendTeamsAlert(sub, alertJob) {
  const { api_name, severity, title, regions, event_type, api_slug } = alertJob;
  const isResolved = event_type === 'resolved';

  const themeColor = isResolved ? '22c55e' : severity === 'critical' ? 'ef4444' : 'f97316';

  const payload = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor,
    summary: isResolved ? `${api_name} - Resolved` : title,
    sections: [{
      activityTitle: isResolved ? `${api_name} - Resolved` : title,
      facts: [
        { name: 'API', value: api_name },
        { name: 'Severity', value: isResolved ? 'Resolved' : severity },
        { name: 'Regions', value: (regions || []).join(', ') || 'Global' },
      ],
      markdown: true,
    }],
    potentialAction: [{
      '@type': 'OpenUri',
      name: 'View Status',
      targets: [{ os: 'default', uri: `https://apidown.net/api/${api_slug}` }],
    }],
  };

  await fetch(sub.destination, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`[alerts] Teams webhook sent for ${api_name}`);
}

async function sendWebhookAlert(sub, alertJob) {
  const { api_name, severity, title, regions, event_type, api_slug, incident_id } = alertJob;
  const isResolved = event_type === 'resolved';

  const payload = {
    event: isResolved ? 'incident.resolved' : 'incident.created',
    api: {
      name: api_name,
      slug: api_slug,
      status_url: `https://apidown.net/api/${api_slug}`,
    },
    incident: {
      id: incident_id,
      title: isResolved ? `${api_name} - Resolved` : title,
      severity: isResolved ? 'resolved' : severity,
      status: isResolved ? 'resolved' : 'investigating',
      regions: regions || [],
      url: `https://apidown.net/incidents/${incident_id}`,
    },
    timestamp: new Date().toISOString(),
  };

  const response = await fetch(sub.destination, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'APIdown-Webhook/1.0',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }

  console.log(`[alerts] Webhook sent to ${sub.destination} for ${api_name}`);
}
