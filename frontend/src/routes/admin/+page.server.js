import { getSupabaseAdmin } from '$lib/supabase-server.js';

export async function load() {
  const supabase = getSupabaseAdmin();

  const { count: apiCount } = await supabase
    .from('apis')
    .select('*', { count: 'exact', head: true });

  const { count: userCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const { count: incidentCount } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'resolved');

  const { count: subCount } = await supabase
    .from('alert_subscriptions')
    .select('*', { count: 'exact', head: true });

  const { data: recentIncidents } = await supabase
    .from('incidents')
    .select('id, title, severity, status, started_at, apis!inner(name)')
    .order('started_at', { ascending: false })
    .limit(10);

  return {
    stats: {
      apis: apiCount || 0,
      users: userCount || 0,
      activeIncidents: incidentCount || 0,
      subscriptions: subCount || 0,
    },
    recentIncidents: recentIncidents || [],
  };
}
