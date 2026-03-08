import { json } from '@sveltejs/kit';
import { setPlatform, getSupabaseAdmin } from '$lib/supabase-server.js';

export async function POST({ request, platform }) {
  setPlatform(platform);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = body.email?.trim()?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Please provide a valid email address.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Upsert to handle duplicate emails gracefully
    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert(
        { email, subscribed_at: new Date().toISOString() },
        { onConflict: 'email', ignoreDuplicates: true }
      );

    if (error) {
      console.error('Newsletter subscribe error:', error);
      return json({ error: 'Failed to subscribe. Please try again.' }, { status: 500 });
    }

    return json({ ok: true });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    return json({ error: 'Failed to subscribe. Please try again.' }, { status: 500 });
  }
}
