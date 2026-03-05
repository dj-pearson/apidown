import { getSupabaseAdmin } from '$lib/supabase-server.js';

export async function load() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: apis, error: apisError } = await supabaseAdmin
      .from('apis')
      .select('id, slug, name, category, current_status, logo_url')
      .order('category')
      .order('name');

    if (apisError) {
      console.error('Supabase apis query error:', JSON.stringify(apisError));
      return { apis: [], activeIncidents: [], error: apisError.message };
    }

    const { data: incidents, error: incError } = await supabaseAdmin
      .from('incidents')
      .select('id, api_id, severity, status, title, started_at')
      .neq('status', 'resolved')
      .order('started_at', { ascending: false })
      .limit(10);

    if (incError) {
      console.error('Supabase incidents query error:', JSON.stringify(incError));
    }

    return {
      apis: apis || [],
      activeIncidents: incidents || [],
    };
  } catch (err) {
    console.error('Page load error:', err.message, err.stack);
    return { apis: [], activeIncidents: [], error: err.message };
  }
}
