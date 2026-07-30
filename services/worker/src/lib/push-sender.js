/**
 * Web Push delivery for watched APIs (US-156).
 *
 * Called by the alert worker when an incident is opened or resolved. Uses the
 * `web-push` library for VAPID signing and payload encryption.
 *
 * Endpoints that the push service reports as gone (404/410) are stamped with
 * failed_at so we stop retrying them; every other failure is left alone so a
 * transient outage at the push service does not discard a subscription.
 */

let _webpush = null;
let _configured = false;

async function webpush() {
  if (_webpush) return _webpush;
  try {
    const mod = await import('web-push');
    _webpush = mod.default || mod;
  } catch {
    console.warn('[push] web-push is not installed — browser notifications are disabled.');
    return null;
  }

  const publicKey = process.env.PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:alerts@apidown.net';

  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID keys are not set — browser notifications are disabled.');
    return null;
  }

  if (!_configured) {
    _webpush.setVapidDetails(subject, publicKey, privateKey);
    _configured = true;
  }
  return _webpush;
}

const SEVERITY_RANK = { minor: 1, major: 2, critical: 3 };

/**
 * Sends a status notification to every browser watching this API, subject to
 * each subscription's minimum severity.
 *
 * @param {object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {{id: string, slug: string, name: string}} params.api
 * @param {'opened'|'resolved'} params.event
 * @param {{severity: string, title: string, id: string}} params.incident
 */
export async function sendPushForIncident({ supabase, api, event, incident, logger = console }) {
  const push = await webpush();
  if (!push) return { sent: 0, skipped: 0, pruned: 0, reason: 'not_configured' };

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, min_severity')
    .contains('api_ids', [api.id])
    .is('failed_at', null);

  if (error) {
    logger.error?.(`[push] Could not load subscriptions: ${error.message}`);
    return { sent: 0, skipped: 0, pruned: 0 };
  }

  const incidentRank = SEVERITY_RANK[incident.severity] || 0;
  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://apidown.net';

  const payload = JSON.stringify({
    title: event === 'resolved' ? `${api.name} is back` : `${api.name} is having problems`,
    body: event === 'resolved'
      ? `Resolved: ${incident.title}`
      : `${incident.severity}: ${incident.title}`,
    url: `${siteUrl}/api/${api.slug}`,
    // One notification per API per event, replacing any earlier one.
    tag: `apidown-${api.slug}-${event}`,
  });

  let sent = 0;
  let skipped = 0;
  let pruned = 0;

  for (const sub of subs || []) {
    // A resolution is always worth sending if they were told about the outage.
    if (event !== 'resolved' && incidentRank < (SEVERITY_RANK[sub.min_severity] || 2)) {
      skipped++;
      continue;
    }

    try {
      await push.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;

      await supabase
        .from('push_subscriptions')
        .update({ last_notified_at: new Date().toISOString() })
        .eq('id', sub.id);
    } catch (err) {
      // 404/410 mean the browser dropped the subscription — stop retrying it.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .update({ failed_at: new Date().toISOString() })
          .eq('id', sub.id);
        pruned++;
      } else {
        logger.error?.(`[push] Send failed for subscription ${sub.id}: ${err.message}`);
      }
    }
  }

  if (sent || pruned) {
    logger.log?.(`[push] ${api.slug} ${event}: sent ${sent}, skipped ${skipped}, pruned ${pruned}`);
  }
  return { sent, skipped, pruned };
}
