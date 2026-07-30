import { json } from '@sveltejs/kit';
import { getSupabaseAdmin, setPlatform, getEnv } from '$lib/supabase-server.js';

/**
 * Web Push subscription management (US-156).
 *
 * POST   — create or update this browser's subscription and watched APIs
 * DELETE — remove it
 * GET    — return the VAPID public key plus this endpoint's current watch list
 *
 * Anonymous by design: the push endpoint URL is the identity, so nobody needs an
 * account to be told their API went down. Nothing here is returned for an
 * endpoint the caller did not supply.
 */

const SEVERITIES = ['critical', 'major', 'minor'];
const MAX_WATCHED = 25;

function vapidPublicKey() {
  return getEnv('PUBLIC_VAPID_PUBLIC_KEY') || getEnv('VAPID_PUBLIC_KEY') || null;
}

/** Push endpoints must be https URLs from the browser's own push service. */
function isValidEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    return new URL(endpoint).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET({ url, platform }) {
  setPlatform(platform);

  const key = vapidPublicKey();
  const endpoint = url.searchParams.get('endpoint');

  if (!endpoint) {
    return json({ vapid_public_key: key, configured: !!key, watching: null });
  }
  if (!isValidEndpoint(endpoint)) {
    return json({ error: 'Invalid push endpoint' }, { status: 400 });
  }

  try {
    const { data: apis } = await getSupabaseAdmin()
      .from('apis')
      .select('id, slug')
      .is('owner_id', null);

    const { data: sub } = await getSupabaseAdmin()
      .from('push_subscriptions')
      .select('api_ids, min_severity')
      .eq('endpoint', endpoint)
      .maybeSingle();

    const slugById = Object.fromEntries((apis || []).map(a => [a.id, a.slug]));

    return json({
      vapid_public_key: key,
      configured: !!key,
      watching: sub ? (sub.api_ids || []).map(id => slugById[id]).filter(Boolean) : [],
      min_severity: sub?.min_severity || 'major',
    });
  } catch (err) {
    console.error('[APIdown] Push GET error:', err?.message || err);
    return json({ error: 'Could not load your notification settings' }, { status: 500 });
  }
}

export async function POST({ request, platform }) {
  setPlatform(platform);

  if (!vapidPublicKey()) {
    return json({ error: 'Push notifications are not configured on this deployment' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const { endpoint, keys, slugs, min_severity: minSeverity } = body || {};

  if (!isValidEndpoint(endpoint)) {
    return json({ error: 'Invalid push endpoint' }, { status: 400 });
  }
  if (!keys?.p256dh || !keys?.auth) {
    return json({ error: 'Missing push encryption keys' }, { status: 400 });
  }
  if (!Array.isArray(slugs)) {
    return json({ error: 'slugs must be an array of API slugs' }, { status: 400 });
  }
  if (slugs.length > MAX_WATCHED) {
    return json({ error: `You can watch at most ${MAX_WATCHED} APIs` }, { status: 400 });
  }
  if (minSeverity && !SEVERITIES.includes(minSeverity)) {
    return json({ error: `min_severity must be one of: ${SEVERITIES.join(', ')}` }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Resolve slugs to ids, ignoring anything that is not a tracked public API.
    const { data: apis } = await supabase
      .from('apis')
      .select('id, slug')
      .in('slug', slugs.length ? slugs : ['__none__'])
      .is('owner_id', null);

    const apiIds = (apis || []).map(a => a.id);

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          api_ids: apiIds,
          min_severity: minSeverity || 'major',
          // Re-subscribing clears a previous delivery failure.
          failed_at: null,
        },
        { onConflict: 'endpoint' },
      );

    if (error) throw error;

    return json({
      subscribed: true,
      watching: (apis || []).map(a => a.slug),
      min_severity: minSeverity || 'major',
    });
  } catch (err) {
    console.error('[APIdown] Push POST error:', err?.message || err);
    return json({ error: 'Could not save your notification settings' }, { status: 500 });
  }
}

export async function DELETE({ request, platform }) {
  setPlatform(platform);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  if (!isValidEndpoint(body?.endpoint)) {
    return json({ error: 'Invalid push endpoint' }, { status: 400 });
  }

  try {
    const { error } = await getSupabaseAdmin()
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', body.endpoint);

    if (error) throw error;
    return json({ unsubscribed: true });
  } catch (err) {
    console.error('[APIdown] Push DELETE error:', err?.message || err);
    return json({ error: 'Could not remove your subscription' }, { status: 500 });
  }
}
