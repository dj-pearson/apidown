import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { featuredComparisons } from '$lib/compare-pairs.js';

export async function load({ setHeaders }) {
  let apis = [];
  try {
    const { data } = await getSupabaseAdmin()
      .from('apis')
      .select('slug, name, category, current_status, owner_id')
      .is('owner_id', null)
      .order('name');
    apis = data || [];
  } catch (err) {
    console.error('Compare hub: Supabase error:', err.message);
  }

  setHeaders({ 'Cache-Control': 'public, max-age=600' });

  return { comparisonGroups: featuredComparisons(apis, { perCategory: 6, maxCategories: 8 }) };
}
