import { getSupabaseAdmin, getEnv } from '$lib/supabase-server.js';
import { redirect } from '@sveltejs/kit';

export async function load({ cookies }) {
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
    profile: profile || { email: user.email, tier: 'free' },
    apiKeys: apiKeys || [],
    subscriptions: subscriptions || [],
    ingestUrl: getEnv('PUBLIC_INGEST_URL') || getEnv('INGEST_URL') || 'https://ingest.apidown.net',
  };
}
