import { setPlatform } from '$lib/supabase-server.js';

export async function load({ cookies, platform }) {
  // Make platform available to supabase-server module
  setPlatform(platform);

  // On Cloudflare Pages, env vars are in platform.env
  const cf = platform?.env || {};

  // Try both naming conventions (PUBLIC_ prefix and without)
  const supabaseUrl = cf.PUBLIC_SUPABASE_URL || cf.SUPABASE_URL || '';
  const supabaseAnonKey = cf.PUBLIC_SUPABASE_ANON_KEY || cf.SUPABASE_ANON_KEY || '';
  const ingestUrl = cf.PUBLIC_INGEST_URL || cf.INGEST_URL || 'https://ingest.apidown.net';

  // Try to get user from Supabase auth cookie
  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) {
    return { user: null, supabaseUrl, supabaseAnonKey, ingestUrl };
  }

  try {
    const { getSupabaseAdmin } = await import('$lib/supabase-server.js');
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return { user: null, supabaseUrl, supabaseAnonKey, ingestUrl };
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    return {
      user: { id: user.id, email: user.email, isAdmin: profile?.is_admin || false },
      supabaseUrl,
      supabaseAnonKey,
      ingestUrl,
    };
  } catch {
    return { user: null, supabaseUrl, supabaseAnonKey, ingestUrl };
  }
}
