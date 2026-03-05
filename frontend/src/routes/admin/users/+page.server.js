import { getSupabaseAdmin } from '$lib/supabase-server.js';

export async function load() {
  const supabase = getSupabaseAdmin();
  const { data: users } = await supabase
    .from('users')
    .select('id, email, display_name, tier, is_admin, created_at')
    .order('created_at', { ascending: false });

  return { users: users || [] };
}
