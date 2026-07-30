import { json } from '@sveltejs/kit';
import { getSupabaseAdmin, setPlatform, getEnv } from '$lib/supabase-server.js';

/**
 * POST /api/[slug]/report — "I'm seeing this too".
 *
 * Deliberately unauthenticated: the whole point is that someone mid-outage can
 * confirm what they're seeing in one click. Abuse is bounded by a per-IP-hash
 * hourly cap, matching the ingest service's existing rule.
 */

const ERROR_TYPES = ['timeout', 'server_error', 'auth_error', 'rate_limited', 'slow', 'other'];
const MAX_PER_HOUR = 3;

/** Salted hash so we can rate limit without storing an IP. */
async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${ip}${salt}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST({ params, request, platform, getClientAddress }) {
  setPlatform(platform);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const errorType = body?.error_type;
  if (errorType && !ERROR_TYPES.includes(errorType)) {
    return json({ error: `error_type must be one of: ${ERROR_TYPES.join(', ')}` }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: api } = await supabase
      .from('apis')
      .select('id')
      .eq('slug', params.slug)
      .maybeSingle();

    if (!api) return json({ error: 'Unknown API' }, { status: 404 });

    const rawIp =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      getClientAddress();
    const reporterIp = await hashIp(rawIp, getEnv('IP_HASH_SALT') || 'apidown-salt');

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentFromReporter } = await supabase
      .from('manual_reports')
      .select('id', { count: 'exact', head: true })
      .eq('api_id', api.id)
      .eq('reporter_ip', reporterIp)
      .gte('created_at', oneHourAgo);

    if ((recentFromReporter || 0) >= MAX_PER_HOUR) {
      return json(
        { error: `You've already reported this API ${MAX_PER_HOUR} times in the last hour.` },
        { status: 429 },
      );
    }

    // Country only — coarse enough to be non-identifying, useful enough to show
    // whether an outage is regional.
    const region = (platform?.cf?.country || request.headers.get('cf-ipcountry') || '')
      .slice(0, 2)
      .toUpperCase() || null;

    const { error: insertError } = await supabase
      .from('manual_reports')
      .insert({
        api_id: api.id,
        reporter_ip: reporterIp,
        error_type: errorType || null,
        region: region === 'XX' ? null : region,
      });

    if (insertError) throw insertError;

    const { count: hourCount } = await supabase
      .from('manual_reports')
      .select('id', { count: 'exact', head: true })
      .eq('api_id', api.id)
      .gte('created_at', oneHourAgo);

    return json({ submitted: true, reports_last_hour: hourCount || 1 }, { status: 201 });
  } catch (err) {
    console.error('[APIdown] Report submit error:', err?.message || err);
    return json({ error: 'Could not record your report. Please try again.' }, { status: 500 });
  }
}
