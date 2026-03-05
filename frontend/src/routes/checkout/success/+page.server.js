import { setPlatform, getSupabaseAdmin } from '$lib/supabase-server.js';
import { getStripe } from '$lib/stripe-server.js';
import { redirect } from '@sveltejs/kit';

export async function load({ url, cookies, platform }) {
  setPlatform(platform);

  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) throw redirect(303, '/dashboard');

  // Verify the session belongs to this user
  const accessToken = cookies.get('sb-access-token');
  if (!accessToken) throw redirect(303, '/login');

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return {
      success: true,
      tier: session.metadata?.tier || session.subscription ? 'paid' : 'unknown',
    };
  } catch {
    throw redirect(303, '/dashboard');
  }
}
