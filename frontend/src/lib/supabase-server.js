import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as pubEnv } from '$env/dynamic/public';

let _supabaseAdmin;

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      pubEnv.PUBLIC_SUPABASE_URL,
      env.PRIVATE_SUPABASE_SERVICE_KEY
    );
  }
  return _supabaseAdmin;
}
