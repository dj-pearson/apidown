import { json, error as kitError } from '@sveltejs/kit';
import { setPlatform, getSupabaseAdmin } from '$lib/supabase-server.js';
import { getStripe, getPriceId } from '$lib/stripe-server.js';

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
    console.error(`[checkout] Missing price ID for tier "${tier}". STRIPE_PRO_PRICE_ID=${getPriceId('pro') ? 'set' : 'MISSING'}, STRIPE_TEAM_PRICE_ID=${getPriceId('team') ? 'set' : 'MISSING'}`);
    return json({ error: 'Stripe price not configured for this tier. Please contact support.' }, { status: 500 });
  }

  try {
    const stripe = getStripe();

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id, email')
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

    // Create Checkout Session
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
