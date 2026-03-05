import { getSupabaseAdmin } from '$lib/supabase-server.js';

const PAGE_SIZE = 20;

export async function load({ url }) {
  const pageNum = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const supabaseAdmin = getSupabaseAdmin();

  // Get total count
  const { count: totalCount } = await supabaseAdmin
    .from('incidents')
    .select('*', { count: 'exact', head: true });

  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: incidents } = await supabaseAdmin
    .from('incidents')
    .select('*, apis!inner(slug, name, id)')
    .order('started_at', { ascending: false })
    .range(from, to);

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
    totalCount: totalCount || 0,
    page: pageNum,
    pageSize: PAGE_SIZE,
  };
}
