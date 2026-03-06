import { json } from '@sveltejs/kit';
import { getSupabaseAdmin, setPlatform, getEnv } from '$lib/supabase-server.js';
import { createClient } from '@supabase/supabase-js';

function setAuthCookies(cookies, access_token, refresh_token) {
  if (access_token) {
    cookies.set('sb-access-token', access_token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  if (refresh_token) {
    cookies.set('sb-refresh-token', refresh_token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

/**
 * POST /auth/login
 * Server-side auth to avoid CORS issues with direct Supabase calls.
 * Body: { email, password, mode: 'login' | 'register' }
 */
export async function POST({ request, cookies, platform }) {
  setPlatform(platform);

  const { email, password, mode } = await request.json();

  if (!email || !password) {
    return json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const url = getEnv('PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
  const anonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    return json({ error: 'Authentication service unavailable.' }, { status: 503 });
  }

  // Use anon key (not service key) for auth — same as the client would
  const supabase = createClient(url, anonKey);

  if (mode === 'register') {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json({ ok: true, message: 'Check your email for a confirmation link.' });
  }

  // Login
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return json({ error: error.message }, { status: 401 });
  }

  setAuthCookies(cookies, data.session.access_token, data.session.refresh_token);
  return json({ ok: true });
}
