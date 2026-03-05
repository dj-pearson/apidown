import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

let _supabase;

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      env.PUBLIC_SUPABASE_URL,
      env.PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}
