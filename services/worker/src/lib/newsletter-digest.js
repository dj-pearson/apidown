import nodemailer from 'nodemailer';

/**
 * Public "API Weather Report" newsletter sender (US-166).
 *
 * Distinct from weekly-digest-worker.js: that one mails registered users a
 * digest scoped to the APIs they personally subscribed to. This one is the
 * public, whole-ecosystem weekly report sent to newsletter_subscribers, and it
 * mirrors what /weekly renders on the web.
 *
 * The digest content itself comes from the frontend's /v1/weekly endpoint, so
 * the email and the /weekly web page are rendered from exactly the same numbers
 * and can never drift apart.
 *
 * Sending is idempotent per week: newsletter_subscribers.last_digest_week is
 * stamped after each successful send, so a retry or a duplicate cron firing
 * will not mail anyone twice.
 */

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://apidown.net';
const BATCH_DELAY_MS = Number(process.env.DIGEST_BATCH_DELAY_MS || 250);

let _transporter = null;
function transporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
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

function formatMinutes(mins) {
  if (!mins) return '0m';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}

/** Plain-text body — the version that actually has to read well everywhere. */
export function renderDigestText(digest, unsubscribeUrl) {
  const lines = [
    'API WEATHER REPORT',
    `${digest.weekLabel} (${digest.week})`,
    '',
    digest.headline,
    '',
    `Incidents: ${digest.totals.incidents}`,
    `APIs affected: ${digest.totals.apisAffected} of ${digest.totals.apisTracked}`,
    `Total downtime: ${formatMinutes(digest.totals.downtimeMinutes)}`,
    '',
  ];

  if (digest.biggestOutages.length) {
    lines.push('BIGGEST OUTAGES');
    for (const o of digest.biggestOutages) {
      lines.push(`- ${o.apiName} (${o.severity}, ${formatMinutes(o.durationMinutes)}): ${o.title}`);
      lines.push(`  ${SITE_URL}/incidents/${o.incidentId}`);
    }
    lines.push('');
  }

  if (digest.regressions.length) {
    lines.push('GOT SLOWER');
    for (const m of digest.regressions) {
      lines.push(`- ${m.apiName}: p95 ${m.p95Before}ms -> ${m.p95Now}ms (+${m.changePct}%)`);
    }
    lines.push('');
  }

  if (digest.improvements.length) {
    lines.push('GOT FASTER');
    for (const m of digest.improvements) {
      lines.push(`- ${m.apiName}: p95 ${m.p95Before}ms -> ${m.p95Now}ms (${m.changePct}%)`);
    }
    lines.push('');
  }

  if (digest.categories.length) {
    lines.push('WHERE THE TROUBLE WAS');
    for (const c of digest.categories) {
      lines.push(`- ${c.label}: ${c.count} incident(s), ${formatMinutes(c.downtimeMinutes)}`);
    }
    lines.push('');
  }

  lines.push(
    `${digest.cleanSheetCount} of ${digest.totals.apisTracked} tracked APIs had a clean sheet.`,
    '',
    `Read this online: ${SITE_URL}/weekly/${digest.week}`,
    '',
    'Figures are measured from crowd-sourced client-side traffic, not vendor reporting.',
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  );

  return lines.join('\n');
}

/** HTML body — table-based layout, inline styles, no external assets. */
export function renderDigestHtml(digest, unsubscribeUrl) {
  const section = (title, inner) =>
    `<tr><td style="padding:20px 24px 0;">
      <h2 style="margin:0 0 10px;font:600 15px/1.3 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">${escapeHtml(title)}</h2>
      ${inner}
    </td></tr>`;

  const outages = digest.biggestOutages.length
    ? section(
        'Biggest outages',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${digest.biggestOutages
          .map(
            o => `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;font:14px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#334155;">
              <strong style="color:#0f172a;">${escapeHtml(o.apiName)}</strong>
              <span style="color:#64748b;"> · ${escapeHtml(o.severity)} · ${formatMinutes(o.durationMinutes)}</span><br />
              <a href="${SITE_URL}/incidents/${encodeURIComponent(o.incidentId)}" style="color:#0891b2;text-decoration:none;">${escapeHtml(o.title)}</a>
            </td></tr>`,
          )
          .join('')}</table>`,
      )
    : '';

  const movers = (title, items, colour, sign) =>
    items.length
      ? section(
          title,
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items
            .map(
              m => `<tr><td style="padding:5px 0;font:14px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#334155;">
                <strong style="color:#0f172a;">${escapeHtml(m.apiName)}</strong>
                <span style="color:${colour};font-weight:600;"> ${sign}${Math.abs(m.changePct)}%</span>
                <span style="color:#64748b;"> — p95 ${m.p95Before}ms → ${m.p95Now}ms</span>
              </td></tr>`,
            )
            .join('')}</table>`,
        )
      : '';

  const categories = digest.categories.length
    ? section(
        'Where the trouble was',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${digest.categories
          .map(
            c => `<tr>
              <td style="padding:5px 0;font:14px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#334155;">${escapeHtml(c.label)}</td>
              <td align="right" style="padding:5px 0;font:14px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#64748b;">${c.count} · ${formatMinutes(c.downtimeMinutes)}</td>
            </tr>`,
          )
          .join('')}</table>`,
      )
    : '';

  const stat = (value, label) =>
    `<td align="center" style="padding:12px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="font:700 20px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a;">${escapeHtml(value)}</div>
      <div style="font:11px/1.3 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">${escapeHtml(label)}</div>
    </td>`;

  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>API Weather Report — ${escapeHtml(digest.weekLabel)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(digest.headline)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:24px 24px 4px;">
        <h1 style="margin:0;font:700 20px/1.3 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">API Weather Report</h1>
        <p style="margin:4px 0 0;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#64748b;">${escapeHtml(digest.weekLabel)} · ${escapeHtml(digest.week)}</p>
        <p style="margin:14px 0 0;font:15px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#334155;">${escapeHtml(digest.headline)}</p>
      </td></tr>

      <tr><td style="padding:18px 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>
          ${stat(String(digest.totals.incidents), 'Incidents')}
          ${stat(String(digest.totals.apisAffected), 'APIs hit')}
          ${stat(formatMinutes(digest.totals.downtimeMinutes), 'Downtime')}
          ${stat(String(digest.cleanSheetCount), 'Clean')}
        </tr></table>
      </td></tr>

      ${outages}
      ${movers('Got slower', digest.regressions, '#dc2626', '+')}
      ${movers('Got faster', digest.improvements, '#059669', '−')}
      ${categories}

      <tr><td style="padding:24px;">
        <a href="${SITE_URL}/weekly/${encodeURIComponent(digest.week)}"
           style="display:inline-block;background:#0891b2;color:#ffffff;font:600 14px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:12px 20px;border-radius:6px;text-decoration:none;">
          Read the full report
        </a>
      </td></tr>

      <tr><td style="padding:0 24px 24px;border-top:1px solid #e2e8f0;">
        <p style="margin:16px 0 0;font:12px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#64748b;">
          Figures are measured from crowd-sourced client-side traffic, not vendor reporting.
        </p>
        <p style="margin:8px 0 0;font:12px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#94a3b8;">
          APIdown.net · <a href="${escapeHtml(unsubscribeUrl)}" style="color:#94a3b8;">Unsubscribe</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Fetch the digest the site itself renders, so the two can't diverge. */
async function fetchDigest(week) {
  const res = await fetch(`${SITE_URL}/v1/weekly/${encodeURIComponent(week)}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message || `Digest fetch failed with HTTP ${res.status}`);
  }
  return { digest: body.data, meta: body.meta };
}

/**
 * Sends the weekly digest to every active subscriber who has not had this
 * week's edition yet.
 *
 * @param {object} deps
 * @param {import('@supabase/supabase-js').SupabaseClient} deps.supabase
 * @param {string} [deps.week]    ISO week key; defaults to the last complete week
 * @param {boolean} [deps.dryRun] Render and log without sending
 */
export async function sendWeeklyDigest({ supabase, week = 'latest', dryRun = false, logger = console }) {
  const { digest, meta } = await fetchDigest(week);
  const resolvedWeek = meta?.week || digest.week;

  if (!meta?.complete) {
    logger.warn?.(`[digest] ${resolvedWeek} is not a finished week yet — refusing to send.`);
    return { week: resolvedWeek, sent: 0, failed: 0, skipped: 0, reason: 'week_incomplete' };
  }

  const { data: subscribers, error } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, unsubscribe_token, last_digest_week')
    .is('unsubscribed_at', null);

  if (error) throw new Error(`Could not load subscribers: ${error.message}`);

  const pending = (subscribers || []).filter(s => s.last_digest_week !== resolvedWeek);
  const skipped = (subscribers || []).length - pending.length;

  logger.log?.(`[digest] ${resolvedWeek}: ${pending.length} to send, ${skipped} already sent`);

  if (dryRun) {
    logger.log?.(renderDigestText(digest, `${SITE_URL}/newsletter/unsubscribe?token=EXAMPLE`));
    return { week: resolvedWeek, sent: 0, failed: 0, skipped, dryRun: true };
  }

  let sent = 0;
  let failed = 0;

  for (const sub of pending) {
    const unsubscribeUrl = `${SITE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(sub.unsubscribe_token)}`;
    try {
      await transporter().sendMail({
        from: process.env.SMTP_FROM || 'APIdown <alerts@apidown.net>',
        to: sub.email,
        subject: `API Weather Report — ${digest.weekLabel}`,
        text: renderDigestText(digest, unsubscribeUrl),
        html: renderDigestHtml(digest, unsubscribeUrl),
        headers: {
          // Lets mail clients offer one-click unsubscribe.
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      // Stamp only after a successful send so a failure is retried next run.
      await supabase
        .from('newsletter_subscribers')
        .update({ last_digest_week: resolvedWeek })
        .eq('id', sub.id);

      sent++;
    } catch (err) {
      failed++;
      logger.error?.(`[digest] Failed to send to subscriber ${sub.id}: ${err.message}`);
    }

    // Gentle pacing so a large list does not trip SMTP rate limits.
    if (BATCH_DELAY_MS > 0) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }

  logger.log?.(`[digest] ${resolvedWeek}: sent ${sent}, failed ${failed}, skipped ${skipped}`);
  return { week: resolvedWeek, sent, failed, skipped };
}
