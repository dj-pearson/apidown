import { env as pubEnv } from '$env/dynamic/public';

export async function load({ cookies }) {
  // Pass public env vars to client (Cloudflare Pages doesn't reliably
  // expose them via $env/dynamic/public on the client side)
  const supabaseUrl = pubEnv.PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = pubEnv.PUBLIC_SUPABASE_ANON_KEY || '';
  const ingestUrl = pubEnv.PUBLIC_INGEST_URL || 'https://ingest.apidown.net';

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

    return {
      user: { id: user.id, email: user.email },
      supabaseUrl,
      supabaseAnonKey,
      ingestUrl,
    };
  } catch {
    return { user: null, supabaseUrl, supabaseAnonKey, ingestUrl };
  }
}
