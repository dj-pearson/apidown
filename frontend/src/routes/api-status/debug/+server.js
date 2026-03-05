import { json } from '@sveltejs/kit';

export async function GET({ platform }) {
  const cf = platform?.env || {};
  // Show available key names (NOT values) for debugging
  return json({
    platformDefined: !!platform,
    envDefined: !!platform?.env,
    envKeys: Object.keys(cf),
    hasSupabaseUrl: !!(cf.PUBLIC_SUPABASE_URL || cf.SUPABASE_URL),
    hasAnonKey: !!(cf.PUBLIC_SUPABASE_ANON_KEY || cf.SUPABASE_ANON_KEY),
    hasServiceKey: !!(cf.PRIVATE_SUPABASE_SERVICE_KEY || cf.SUPABASE_SERVICE_KEY),
  });
}
