import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function load() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: apis, error: apisError } = await supabaseAdmin
    .from('apis')
    .select('id, slug, name, category, current_status, logo_url')
    .order('category')
    .order('name');

  if (apisError) throw error(500, apisError.message);

  const { data: incidents } = await supabaseAdmin
    .from('incidents')
    .select('id, api_id, severity, status, title, started_at')
    .neq('status', 'resolved')
    .order('started_at', { ascending: false })
    .limit(10);

  return {
    apis: apis || [],
    activeIncidents: incidents || [],
  };
}
