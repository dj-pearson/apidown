import { getSupabaseAdmin } from '$lib/supabase-server.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One-click unsubscribe from the weekly digest. The token identifies exactly one
 * subscription, so no login is needed and the address never appears in the URL.
 */
export async function load({ url, setHeaders }) {
  setHeaders({ 'cache-control': 'no-store' });

  const token = url.searchParams.get('token');

  if (!token || !UUID_RE.test(token)) {
    return { status: 'error', message: 'That unsubscribe link is not valid.' };
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: subscriber } = await supabase
      .from('newsletter_subscribers')
      .select('id, unsubscribed_at')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (!subscriber) {
      return { status: 'error', message: 'We could not find that subscription. It may already have been removed.' };
    }

    if (subscriber.unsubscribed_at) {
      return { status: 'success', message: "You're already unsubscribed — nothing more to do." };
    }

    const { error } = await supabase
      .from('newsletter_subscribers')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('id', subscriber.id);

    if (error) throw error;

    return { status: 'success', message: "You're unsubscribed from the weekly digest." };
  } catch (err) {
    console.error('[APIdown] Newsletter unsubscribe error:', err?.message || err);
    return { status: 'error', message: 'Something went wrong. Please try again in a moment.' };
  }
}
