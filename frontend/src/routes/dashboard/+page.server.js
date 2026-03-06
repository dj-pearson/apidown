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

  // Sync tier with Stripe on every dashboard load
  let syncedProfile = profile;
  if (profile?.stripe_customer_id) {
    try {
      const { getStripe, getTierFromSubscription, stripePeriodEnd } = await import('$lib/stripe-server.js');
      const stripe = getStripe();
      const subs = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
        expand: ['data.items'],
      });

      if (subs.data.length > 0) {
        // Has active subscription — sync tier from Stripe
        const sub = subs.data[0];
        const tier = getTierFromSubscription(sub);
        if (tier !== profile.tier || profile.stripe_subscription_id !== sub.id) {
          const updateData = {
            tier,
            stripe_subscription_id: sub.id,
            billing_period_end: stripePeriodEnd(sub),
          };
          await supabase.from('users').update(updateData).eq('id', user.id);
          syncedProfile = { ...profile, ...updateData };
          console.log(`[dashboard] Synced user ${user.id} tier to ${tier} from Stripe`);
        }
      } else if (profile.tier !== 'free') {
        // No active subscription but DB shows paid — downgrade to free
        const updateData = {
          tier: 'free',
          stripe_subscription_id: null,
          billing_period_end: null,
        };
        await supabase.from('users').update(updateData).eq('id', user.id);
        syncedProfile = { ...profile, ...updateData };
        console.log(`[dashboard] Downgraded user ${user.id} to free (no active Stripe subscription)`);
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

  // Get user's pinned APIs (My Stack)
  const { data: pinnedApis } = await supabase
    .from('pinned_apis')
    .select('api_id, created_at, cost_per_minute_cents, apis!inner(slug, name, current_status, logo_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  // Get user's custom APIs
  const { data: customApis } = await supabase
    .from('apis')
    .select('id, slug, name, base_domains, probe_url, expected_status, current_status, probe_auth_hint, created_at')
    .eq('owner_id', user.id)
    .eq('is_custom', true)
    .order('created_at', { ascending: false });

  // Get user's alert subscriptions
  const { data: subscriptions } = await supabase
    .from('alert_subscriptions')
    .select('id, api_id, channel, destination, created_at, apis!inner(slug, name)')
    .eq('email', user.email)
    .order('created_at', { ascending: false });

  // SLA target summary for dashboard widget
  let slaSummary = { total: 0, passing: 0 };
  const userTier = syncedProfile?.tier || profile?.tier || 'free';
  if (userTier !== 'free') {
    const { data: slaTargets } = await supabase
      .from('sla_targets')
      .select('id, api_id, uptime_target_pct')
      .eq('user_id', user.id);

    if (slaTargets && slaTargets.length > 0) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const totalMs = monthEnd.getTime() - monthStart.getTime();

      let passing = 0;
      for (const target of slaTargets) {
        const { data: incidents } = await supabase
          .from('incidents')
          .select('started_at, resolved_at')
          .eq('api_id', target.api_id)
          .gte('started_at', monthStart.toISOString())
          .lte('started_at', monthEnd.toISOString());

        let downtimeMs = 0;
        for (const inc of (incidents || [])) {
          const start = new Date(inc.started_at).getTime();
          const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now.getTime();
          const overlapStart = Math.max(start, monthStart.getTime());
          const overlapEnd = Math.min(end, monthEnd.getTime());
          if (overlapStart < overlapEnd) downtimeMs += overlapEnd - overlapStart;
        }

        const actualUptime = (1 - downtimeMs / totalMs) * 100;
        if (actualUptime >= Number(target.uptime_target_pct)) passing++;
      }

      slaSummary = { total: slaTargets.length, passing };
    }
  }

  return {
    profile: syncedProfile || { email: user.email, tier: 'free' },
    apiKeys: apiKeys || [],
    pinnedApis: pinnedApis || [],
    customApis: customApis || [],
    subscriptions: subscriptions || [],
    slaSummary,
    ingestUrl: getEnv('PUBLIC_INGEST_URL') || getEnv('INGEST_URL') || 'https://ingest.apidown.net',
    supabaseUrl: getEnv('PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL'),
    supabaseAnonKey: getEnv('PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY'),
  };
}
