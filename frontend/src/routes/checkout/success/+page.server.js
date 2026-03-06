import { setPlatform, getSupabaseAdmin } from '$lib/supabase-server.js';
import { getStripe } from '$lib/stripe-server.js';
import { redirect } from '@sveltejs/kit';

export async function load({ url, cookies, platform }) {
  setPlatform(platform);

  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) throw redirect(303, '/dashboard');

  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) throw redirect(303, '/login');

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
  if (authErr || !user) throw redirect(303, '/login');

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    // Verify this session belongs to the logged-in user
    const sub = session.subscription;
    const subObj = typeof sub === 'string' ? await stripe.subscriptions.retrieve(sub) : sub;
    const tier = subObj?.metadata?.tier || session.metadata?.tier || 'pro';

    // Update the user's tier directly (don't rely solely on webhook)
    if (subObj) {
      await supabase.from('users').update({
        tier,
        stripe_customer_id: session.customer,
        stripe_subscription_id: subObj.id,
        billing_period_end: new Date(subObj.current_period_end * 1000).toISOString(),
      }).eq('id', user.id);
    }

    return { success: true, tier };
  } catch (err) {
    console.error('[checkout-success] Error:', err.message);
    throw redirect(303, '/dashboard');
  }
}
