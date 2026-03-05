import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as pubEnv } from '$env/dynamic/public';

let _supabaseAdmin;

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = pubEnv.PUBLIC_SUPABASE_URL;
    const key = env.PRIVATE_SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}
