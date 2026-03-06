import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function load({ params, platform, setHeaders }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();

  // Look up user by public_status_slug
  const { data: owner, error: userErr } = await supabase
    .from('users')
    .select('id, public_status_title, public_status_description, public_status_enabled, public_status_slug')
    .eq('public_status_slug', params.slug)
    .single();

  if (userErr || !owner) {
    throw error(404, 'Status page not found');
  }

  if (!owner.public_status_enabled) {
    throw error(404, 'This status page is not currently available');
  }

  // Load pinned APIs for this user with current status
  const { data: pinnedApis } = await supabase
    .from('pinned_apis')
    .select('api_id, apis!inner(id, slug, name, current_status, logo_url)')
    .eq('user_id', owner.id)
    .order('created_at', { ascending: true });

  // Cache for 60 seconds
  setHeaders({
    'Cache-Control': 'public, max-age=60',
  });

  return {
    title: owner.public_status_title || 'Status',
    description: owner.public_status_description || '',
    apis: (pinnedApis || []).map(p => ({
      slug: p.apis.slug,
      name: p.apis.name,
      status: p.apis.current_status,
      logo_url: p.apis.logo_url,
    })),
  };
}
