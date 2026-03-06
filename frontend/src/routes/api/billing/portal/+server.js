import { json } from '@sveltejs/kit';
import { setPlatform, getSupabaseAdmin } from '$lib/supabase-server.js';
import { getStripe } from '$lib/stripe-server.js';

/** Create a Stripe Billing Portal session so users can manage their subscription */
export async function POST({ cookies, platform, url }) {
  setPlatform(platform);

  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) return json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
  if (authErr || !user) return json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return json({ error: 'No billing account found. You need an active subscription first.' }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${url.origin}/dashboard`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('[billing-portal] Stripe error:', err.message);
    return json({ error: err.message || 'Failed to open billing portal' }, { status: 500 });
  }
}
