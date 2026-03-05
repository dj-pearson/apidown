import { supabaseAdmin } from '$lib/supabase-server.js';

export async function load() {
  const { data: incidents } = await supabaseAdmin
    .from('incidents')
    .select('*, apis!inner(slug, name)')
    .order('started_at', { ascending: false })
    .limit(50);

  return {
    incidents: incidents || [],
  };
}
