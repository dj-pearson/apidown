import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

export async function POST({ request, platform }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { pageId, email } = body;
  if (!pageId || !email) {
    return json({ error: 'Missing pageId or email' }, { status: 400 });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address' }, { status: 400 });
  }

  // Verify the page exists and is enabled
  const { data: page } = await supabase
    .from('status_pages')
    .select('id, is_enabled')
    .eq('id', pageId)
    .single();

  if (!page || !page.is_enabled) {
    return json({ error: 'Status page not found' }, { status: 404 });
  }

  const verifyToken = randomUUID();

  const { error: insertErr } = await supabase
    .from('status_page_subscribers')
    .upsert({
      status_page_id: pageId,
      email: email.toLowerCase().trim(),
      verify_token: verifyToken,
      verified: false,
    }, { onConflict: 'status_page_id,email' });

  if (insertErr) {
    console.error('[subscribe] Insert error:', insertErr.message);
    return json({ error: 'Failed to subscribe' }, { status: 500 });
  }

  // TODO: Send verification email with token link
  // For now, auto-verify (can be enhanced with email verification flow)
  await supabase
    .from('status_page_subscribers')
    .update({ verified: true })
    .eq('status_page_id', pageId)
    .eq('email', email.toLowerCase().trim());

  return json({ ok: true });
}
