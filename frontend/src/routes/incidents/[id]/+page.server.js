import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const supabaseAdmin = getSupabaseAdmin();
  const { id } = params;

  const { data: incident } = await supabaseAdmin
    .from('incidents')
    .select('*, apis!inner(slug, name, logo_url)')
    .eq('id', id)
    .single();

  if (!incident) throw error(404, 'Incident not found');

  // Count manual reports during incident window
  const { count } = await supabaseAdmin
    .from('manual_reports')
    .select('*', { count: 'exact', head: true })
    .eq('api_id', incident.api_id)
    .gte('created_at', incident.started_at)
    .lte('created_at', incident.resolved_at || new Date().toISOString());

  // Fetch timeline updates
  const { data: updates } = await supabaseAdmin
    .from('incident_updates')
    .select('id, status, message, created_at')
    .eq('incident_id', id)
    .order('created_at', { ascending: true });

  return {
    incident: { ...incident, report_count: count || 0 },
    updates: updates || [],
  };
}
