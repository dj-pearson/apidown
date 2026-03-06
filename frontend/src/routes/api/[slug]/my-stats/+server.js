import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { json, error } from '@sveltejs/kit';

export async function GET({ params, cookies }) {
  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) throw error(401, 'Not authenticated');

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
  if (authErr || !user) throw error(401, 'Invalid session');

  // Look up API by slug
  const { data: api } = await supabase
    .from('apis')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!api) throw error(404, 'API not found');

  // Check user tier
  const { data: profile } = await supabase
    .from('users')
    .select('tier')
    .eq('id', user.id)
    .single();

  if (!profile || profile.tier === 'free') {
    return json({ locked: true, tier: 'free' });
  }

  // Call the RPC function for user-scoped stats
  const { data: stats, error: rpcErr } = await supabase
    .rpc('get_api_stats_for_user', {
      p_api_id: api.id,
      p_user_id: user.id,
      p_minutes: 60,
    });

  if (rpcErr) {
    console.error('RPC error:', rpcErr.message);
    throw error(500, 'Failed to fetch stats');
  }

  const row = Array.isArray(stats) ? stats[0] : stats;

  return json({
    locked: false,
    stats: row || { total_signals: 0, error_count: 0, avg_duration_ms: 0, p50_ms: 0, p95_ms: 0 },
  });
}
