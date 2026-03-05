import { getSupabaseAdmin } from '$lib/supabase-server.js';

export async function load() {
  const supabase = getSupabaseAdmin();
  const { data: incidents } = await supabase
    .from('incidents')
    .select('*, apis!inner(name, slug)')
    .order('started_at', { ascending: false })
    .limit(100);

  return { incidents: incidents || [] };
}
