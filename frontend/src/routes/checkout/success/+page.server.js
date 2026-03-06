import { setPlatform, getSupabaseAdmin } from '$lib/supabase-server.js';
import { getStripe, getTierFromSubscription } from '$lib/stripe-server.js';
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
      expand: ['subscription', 'subscription.items'],
    });

    const sub = session.subscription;
    const subObj = typeof sub === 'string' ? await stripe.subscriptions.retrieve(sub, { expand: ['items'] }) : sub;
    const tier = getTierFromSubscription(subObj) || session.metadata?.tier || 'pro';
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

    console.log(`[checkout-success] Session ${sessionId}: tier=${tier}, customer=${customerId}, subscription=${subObj?.id}, user=${user.id}`);

    if (subObj) {
      const updateData = {
        tier,
        stripe_customer_id: customerId,
        stripe_subscription_id: subObj.id,
        billing_period_end: new Date(subObj.current_period_end * 1000).toISOString(),
      };
      const { error: updateErr } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (updateErr) {
        console.error('[checkout-success] DB update failed:', updateErr.message, updateErr.code, updateErr.details);
        const { error: tierErr } = await supabase
          .from('users')
          .update({ tier })
          .eq('id', user.id);
        if (tierErr) {
          console.error('[checkout-success] Tier-only update also failed:', tierErr.message);
        }
      } else {
        console.log(`[checkout-success] User ${user.id} upgraded to ${tier}`);
      }
    }

    return { success: true, tier };
  } catch (err) {
    console.error('[checkout-success] Error:', err.message);
    throw redirect(303, '/dashboard');
  }
}
