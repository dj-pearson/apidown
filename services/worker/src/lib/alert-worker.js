import nodemailer from 'nodemailer';

const ALERTS_QUEUE = 'alerts:pending';
const BATCH_SIZE = 50;

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
 */
export async function drainAlerts(redis, supabase) {
  const pipeline = redis.pipeline();
  pipeline.lrange(ALERTS_QUEUE, 0, BATCH_SIZE - 1);
  pipeline.ltrim(ALERTS_QUEUE, BATCH_SIZE, -1);
  const results = await pipeline.exec();

  const rawItems = results[0][1];
  if (!rawItems || rawItems.length === 0) return;

  for (const raw of rawItems) {
    let alertJob;
    try {
      alertJob = JSON.parse(raw);
    } catch {
      continue;
    }

    await processAlert(supabase, alertJob);
  }
}

async function processAlert(supabase, alertJob) {
  const { incident_id, api_slug, api_name, severity, title, regions, event_type } = alertJob;

  // Get subscribers for this API
  const { data: subs, error } = await supabase
    .from('alert_subscriptions')
    .select('id, channel, destination, token')
    .eq('api_id', alertJob.api_id)
    .eq('verified', true);

  if (error || !subs || subs.length === 0) return;

  for (const sub of subs) {
    // Dedup check: already sent this alert?
    const { data: existing } = await supabase
      .from('alert_log')
      .select('id')
      .eq('incident_id', incident_id)
      .eq('subscription_id', sub.id)
      .limit(1);

    if (existing && existing.length > 0) continue;

    try {
      if (sub.channel === 'email') {
        await sendEmailAlert(sub, alertJob);
      } else if (sub.channel === 'slack') {
        await sendSlackAlert(sub, alertJob);
      } else if (sub.channel === 'pagerduty') {
        await sendPagerDutyAlert(sub, alertJob);
      } else if (sub.channel === 'discord') {
        await sendDiscordAlert(sub, alertJob);
      } else if (sub.channel === 'teams') {
        await sendTeamsAlert(sub, alertJob);
      } else if (sub.channel === 'webhook') {
        await sendWebhookAlert(sub, alertJob);
      }
      // Log that we sent it
      await supabase.from('alert_log').insert({
        incident_id,
        subscription_id: sub.id,
      });
    } catch (err) {
      console.error(`[alerts] Failed to send ${sub.channel} alert:`, err.message);
    }
  }
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
