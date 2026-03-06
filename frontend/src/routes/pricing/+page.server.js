import { setPlatform, getSupabaseAdmin } from '$lib/supabase-server.js';

export async function load({ parent, cookies, platform }) {
  setPlatform(platform);
  const { user } = await parent();

  let tier = 'free';
  if (user) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: profile } = await supabase
        .from('users')
        .select('tier')
        .eq('id', user.id)
        .single();
      tier = profile?.tier || 'free';
    } catch {
      // fallback to free
    }
  }

  return { user, tier };
}
