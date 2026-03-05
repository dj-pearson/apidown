import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { fail } from '@sveltejs/kit';

export async function load() {
  const supabase = getSupabaseAdmin();
  const { data: apis } = await supabase
    .from('apis')
    .select('*')
    .order('category')
    .order('name');

  return { apis: apis || [] };
}

export const actions = {
  create: async ({ request }) => {
    const supabase = getSupabaseAdmin();
    const fd = await request.formData();

    const name = fd.get('name')?.toString().trim();
    const slug = fd.get('slug')?.toString().trim();
    const category = fd.get('category')?.toString().trim();
    const domainsStr = fd.get('base_domains')?.toString().trim() || '';
    const logo_url = fd.get('logo_url')?.toString().trim() || null;
    const status_page = fd.get('status_page')?.toString().trim() || null;

    if (!name || !slug || !category) {
      return fail(400, { error: 'Name, slug, and category are required.' });
    }

    const base_domains = domainsStr.split(',').map(d => d.trim()).filter(Boolean);
    if (base_domains.length === 0) {
      return fail(400, { error: 'At least one domain is required.' });
    }

    const { error } = await supabase.from('apis').insert({
      name, slug, category, base_domains, logo_url, status_page,
      current_status: 'operational',
    });

    if (error) {
      if (error.code === '23505') return fail(409, { error: `Slug "${slug}" already exists.` });
      return fail(500, { error: error.message });
    }

    return { success: true };
  },

  update: async ({ request }) => {
    const supabase = getSupabaseAdmin();
    const fd = await request.formData();

    const id = fd.get('id')?.toString();
    const name = fd.get('name')?.toString().trim();
    const slug = fd.get('slug')?.toString().trim();
    const category = fd.get('category')?.toString().trim();
    const domainsStr = fd.get('base_domains')?.toString().trim() || '';
    const logo_url = fd.get('logo_url')?.toString().trim() || null;
    const status_page = fd.get('status_page')?.toString().trim() || null;
    const current_status = fd.get('current_status')?.toString().trim() || 'operational';

    if (!id || !name || !slug || !category) {
      return fail(400, { error: 'ID, name, slug, and category are required.' });
    }

    const base_domains = domainsStr.split(',').map(d => d.trim()).filter(Boolean);

    const { error } = await supabase.from('apis').update({
      name, slug, category, base_domains, logo_url, status_page, current_status,
    }).eq('id', id);

    if (error) {
      if (error.code === '23505') return fail(409, { error: `Slug "${slug}" already exists.` });
      return fail(500, { error: error.message });
    }

    return { success: true };
  },

  delete: async ({ request }) => {
    const supabase = getSupabaseAdmin();
    const fd = await request.formData();
    const id = fd.get('id')?.toString();
    if (!id) return fail(400, { error: 'ID is required.' });

    const { error } = await supabase.from('apis').delete().eq('id', id);
    if (error) return fail(500, { error: error.message });

    return { success: true };
  },

  toggleStatus: async ({ request }) => {
    const supabase = getSupabaseAdmin();
    const fd = await request.formData();
    const id = fd.get('id')?.toString();
    const currentStatus = fd.get('current_status')?.toString();
    if (!id) return fail(400, { error: 'ID is required.' });

    const next = currentStatus === 'operational' ? 'degraded'
      : currentStatus === 'degraded' ? 'down'
      : 'operational';

    const { error } = await supabase.from('apis').update({ current_status: next }).eq('id', id);
    if (error) return fail(500, { error: error.message });

    return { success: true };
  },
};
