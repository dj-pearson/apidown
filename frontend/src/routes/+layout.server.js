import { getSupabaseAdmin } from '$lib/supabase-server.js';

export async function load({ cookies }) {
  // Try to get user from Supabase auth cookie
  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) {
    return { user: null };
  }

  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return { user: null };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
  };
}
