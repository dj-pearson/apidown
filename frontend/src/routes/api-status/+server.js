import { json } from '@sveltejs/kit';
import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';

export async function GET({ platform }) {
  setPlatform(platform);
  const supabaseAdmin = getSupabaseAdmin();
  const { data: apis, error } = await supabaseAdmin
    .from('apis')
    .select('slug, name, category, current_status')
    .order('category')
    .order('name');

  if (error) {
    return json({ error: 'Failed to load API status' }, { status: 500 });
  }

  const statuses = (apis || []).map(api => ({
    slug: api.slug,
    name: api.name,
    category: api.category,
    status: api.current_status,
  }));

  return json({
    updated_at: new Date().toISOString(),
    count: statuses.length,
    apis: statuses,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  });
}
