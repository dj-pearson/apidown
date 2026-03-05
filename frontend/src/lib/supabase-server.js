import { createClient } from '@supabase/supabase-js';

let _supabaseAdmin;
let _platform;

/** Call once from +layout.server.js to provide the platform env */
export function setPlatform(platform) {
  _platform = platform;
  _supabaseAdmin = null; // reset on new request
}

/** Get a platform env var by name (tries with and without PUBLIC_/PRIVATE_ prefix) */
export function getEnv(name) {
  const cf = _platform?.env || {};
  return cf[name] || '';
}

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const cf = _platform?.env || {};
    const url = cf.PUBLIC_SUPABASE_URL || cf.SUPABASE_URL;
    const key = cf.PRIVATE_SUPABASE_SERVICE_KEY || cf.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error(
        `Missing Supabase env vars. Found keys: ${Object.keys(cf).join(', ') || 'none'}`
      );
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}
