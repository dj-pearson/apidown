import { getSupabaseAdmin } from '$lib/supabase-server.js';

export async function load() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: incidents } = await supabaseAdmin
    .from('incidents')
    .select('*, apis!inner(slug, name, id)')
    .order('started_at', { ascending: false })
    .limit(50);

  // Get report counts for each incident's API during the incident window
  const enriched = [];
  for (const inc of (incidents || [])) {
    const { count } = await supabaseAdmin
      .from('manual_reports')
      .select('*', { count: 'exact', head: true })
      .eq('api_id', inc.api_id)
      .gte('created_at', inc.started_at)
      .lte('created_at', inc.resolved_at || new Date().toISOString());
    enriched.push({ ...inc, report_count: count || 0 });
  }

  return {
    incidents: enriched,
  };
}
