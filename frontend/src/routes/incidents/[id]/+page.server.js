import { supabaseAdmin } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const { id } = params;

  const { data: incident } = await supabaseAdmin
    .from('incidents')
    .select('*, apis!inner(slug, name, logo_url)')
    .eq('id', id)
    .single();

  if (!incident) throw error(404, 'Incident not found');

  return { incident };
}
