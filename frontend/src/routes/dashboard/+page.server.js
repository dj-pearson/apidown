import { getSupabaseAdmin, getEnv } from '$lib/supabase-server.js';
import { redirect } from '@sveltejs/kit';

export async function load({ cookies, platform }) {
  const { setPlatform } = await import('$lib/supabase-server.js');
  setPlatform(platform);

  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) throw redirect(303, '/login');

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
  if (authErr || !user) throw redirect(303, '/login');

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // If user has a stripe_customer_id but shows free tier, sync from Stripe
  let syncedProfile = profile;
  if (profile?.stripe_customer_id && profile.tier === 'free') {
    try {
      const { getStripe, getTierFromSubscription } = await import('$lib/stripe-server.js');
      const stripe = getStripe();
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
        expand: ['data.items'],
      });
      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const tier = getTierFromSubscription(sub);
        const updateData = {
          tier,
          stripe_subscription_id: sub.id,
          billing_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        };
        await supabase.from('users').update(updateData).eq('id', user.id);
        syncedProfile = { ...profile, ...updateData };
        console.log(`[dashboard] Synced user ${user.id} tier to ${tier} from Stripe`);
      }
    } catch (err) {
      console.error('[dashboard] Stripe sync error:', err.message);
    }
  }

  // Get user's API keys
  const { data: apiKeys } = await supabase
    .from('api_keys')
    .select('id, key_prefix, label, is_active, last_used_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Get user's alert subscriptions
  const { data: subscriptions } = await supabase
    .from('alert_subscriptions')
    .select('id, api_id, channel, destination, created_at, apis!inner(slug, name)')
    .eq('email', user.email)
    .order('created_at', { ascending: false });

  return {
    profile: syncedProfile || { email: user.email, tier: 'free' },
    apiKeys: apiKeys || [],
    subscriptions: subscriptions || [],
    ingestUrl: getEnv('PUBLIC_INGEST_URL') || getEnv('INGEST_URL') || 'https://ingest.apidown.net',
    supabaseUrl: getEnv('PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL'),
    supabaseAnonKey: getEnv('PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY'),
  };
}
