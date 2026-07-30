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

  // Lightweight API index — powers the command palette (US-155) and stack
  // picker (US-153) on every route. Kept to five columns to stay cheap.
  async function loadApiIndex() {
    try {
      const { getSupabaseAdmin } = await import('$lib/supabase-server.js');
      const { data } = await getSupabaseAdmin()
        .from('apis')
        .select('slug, name, category, current_status')
        .is('owner_id', null)
        .order('name');
      return data || [];
    } catch (err) {
      console.error('[APIdown] API index load error:', err?.message || err);
      return [];
    }
  }

  // Try to get user from Supabase auth cookie
  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) {
    return { user: null, supabaseUrl, supabaseAnonKey, ingestUrl, apiIndex: await loadApiIndex() };
  }

  try {
    const { getSupabaseAdmin } = await import('$lib/supabase-server.js');
    const supabase = getSupabaseAdmin();
    const [{ data: { user }, error }, apiIndex] = await Promise.all([
      supabase.auth.getUser(accessToken),
      loadApiIndex(),
    ]);

    if (error || !user) {
      return { user: null, supabaseUrl, supabaseAnonKey, ingestUrl, apiIndex };
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
      apiIndex,
    };
  } catch (err) {
    console.error('[APIdown] Layout auth/session error:', err?.message || err);
    return { user: null, supabaseUrl, supabaseAnonKey, ingestUrl, apiIndex: await loadApiIndex() };
  }
}
