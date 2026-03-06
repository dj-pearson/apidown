import { json } from '@sveltejs/kit';
import { setPlatform, getSupabaseAdmin } from '$lib/supabase-server.js';
import { getStripe, getPriceId, getTierFromSubscription, stripePeriodEnd } from '$lib/stripe-server.js';

export async function POST({ request, cookies, platform, url }) {
  setPlatform(platform);

  // Authenticate user
  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) return json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
  if (authErr || !user) return json({ error: 'Not authenticated' }, { status: 401 });

  // Get requested tier
  const body = await request.json();
  const tier = body.tier;
  if (!['pro', 'team'].includes(tier)) return json({ error: 'Invalid tier' }, { status: 400 });

  const priceId = getPriceId(tier);
  if (!priceId) {
    console.error(`[checkout] Missing price ID for tier "${tier}".`);
    return json({ error: 'Stripe price not configured for this tier. Please contact support.' }, { status: 500 });
  }

  try {
    const stripe = getStripe();

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id, email')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Check for existing active subscription — upgrade/downgrade in place
    if (customerId) {
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        expand: ['data.items'],
        limit: 10,
      });

      if (existingSubs.data.length > 0) {
        // Find the subscription to update (use the first active one)
        const activeSub = existingSubs.data[0];
        const currentItem = activeSub.items.data[0];

        if (currentItem) {
          // Update the subscription's price (immediate proration)
          const updated = await stripe.subscriptions.update(activeSub.id, {
            items: [{
              id: currentItem.id,
              price: priceId,
            }],
            proration_behavior: 'create_prorations',
            metadata: { supabase_user_id: user.id, tier },
          });

          // Cancel any other active subscriptions (cleanup duplicates)
          for (let i = 1; i < existingSubs.data.length; i++) {
            await stripe.subscriptions.cancel(existingSubs.data[i].id);
          }

          // Update the user's tier immediately
          const updateData = {
            tier,
            stripe_subscription_id: updated.id,
          };
          updateData.billing_period_end = stripePeriodEnd(updated);
          await supabase.from('users').update(updateData).eq('id', user.id);

          console.log(`[checkout] Upgraded user ${user.id} to ${tier} via subscription update`);
          return json({ upgraded: true, tier });
        }
      }
    }

    // No existing subscription — create new checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${url.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${url.origin}/pricing`,
      metadata: { supabase_user_id: user.id, tier },
      subscription_data: {
        metadata: { supabase_user_id: user.id, tier },
      },
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('[checkout] Stripe error:', err.message, err.type || '', err.code || '');
    return json({ error: err.message || 'Failed to create checkout session' }, { status: 500 });
  }
}
