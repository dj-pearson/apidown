import { createClient } from '@supabase/supabase-js';

let _supabase;
let _url;
let _key;

/** Call this once from +layout.svelte to set the config from server data */
export function initSupabase(url, anonKey) {
  _url = url;
  _key = anonKey;
  _supabase = null; // reset if re-init
}

export function getSupabase() {
  if (!_supabase) {
    if (!_url || !_key) {
      throw new Error(
        'Supabase not initialized. Ensure initSupabase() is called from +layout.svelte'
      );
    }
    _supabase = createClient(_url, _key);
  }
  return _supabase;
}
