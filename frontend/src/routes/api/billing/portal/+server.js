import { json, error as kitError } from '@sveltejs/kit';
import { setPlatform, getSupabaseAdmin } from '$lib/supabase-server.js';
import { getStripe } from '$lib/stripe-server.js';

/** Create a Stripe Billing Portal session so users can manage their subscription */
export async function POST({ cookies, platform, url }) {
  setPlatform(platform);

  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) throw kitError(401, 'Not authenticated');

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
  if (authErr || !user) throw kitError(401, 'Not authenticated');

  const { data: profile } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    throw kitError(400, 'No billing account found');
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${url.origin}/dashboard`,
  });

  return json({ url: session.url });
}
