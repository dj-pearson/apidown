import { getSupabaseAdmin } from '$lib/supabase-server.js';

export async function load() {
  const supabase = getSupabaseAdmin();
  const { data: apis } = await supabase
    .from('apis')
    .select('*')
    .order('category')
    .order('name');

  return { apis: apis || [] };
}
