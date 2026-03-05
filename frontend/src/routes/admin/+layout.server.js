import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { redirect } from '@sveltejs/kit';

export async function load({ cookies }) {
  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) throw redirect(303, '/login');

  const supabase = getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) throw redirect(303, '/login');

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) throw redirect(303, '/');

  return { isAdmin: true };
}
