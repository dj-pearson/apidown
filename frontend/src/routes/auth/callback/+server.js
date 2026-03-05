import { redirect, json } from '@sveltejs/kit';

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

/** OAuth redirect flow */
export async function GET({ url, cookies }) {
  const access_token = url.searchParams.get('access_token');
  const refresh_token = url.searchParams.get('refresh_token');
  setAuthCookies(cookies, access_token, refresh_token);
  throw redirect(303, '/dashboard');
}

/** Password login flow — sets cookies and returns JSON */
export async function POST({ request, cookies }) {
  const { access_token, refresh_token } = await request.json();
  setAuthCookies(cookies, access_token, refresh_token);
  return json({ ok: true });
}
