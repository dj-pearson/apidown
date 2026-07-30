import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { v1Json, v1Error, v1Options, parsePaging, publicIncident } from '$lib/server/v1.js';

export const OPTIONS = v1Options;

const SEVERITIES = ['critical', 'major', 'minor'];
const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'];

/** GET /v1/incidents — incidents across all tracked APIs, newest first. */
export async function GET({ url, platform }) {
  setPlatform(platform);

  const { limit, offset } = parsePaging(url.searchParams, { defaultLimit: 50, maxLimit: 200 });
  const apiSlug = url.searchParams.get('api');
  const severity = url.searchParams.get('severity');
  const status = url.searchParams.get('status');
  const openOnly = url.searchParams.get('open') === 'true';

  if (severity && !SEVERITIES.includes(severity)) {
    return v1Error('invalid_severity', `severity must be one of: ${SEVERITIES.join(', ')}`, 400);
  }
  if (status && !STATUSES.includes(status)) {
    return v1Error('invalid_status', `status must be one of: ${STATUSES.join(', ')}`, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: apis } = await supabase
      .from('apis')
      .select('id, slug')
      .is('owner_id', null);

    const apiList = apis || [];
    const slugById = {};
    for (const a of apiList) slugById[a.id] = a.slug;

    let apiIds = apiList.map(a => a.id);
    if (apiSlug) {
      const match = apiList.find(a => a.slug === apiSlug);
      if (!match) return v1Error('not_found', `No tracked API with slug "${apiSlug}"`, 404);
      apiIds = [match.id];
    }

    if (apiIds.length === 0) return v1Json([], { meta: { total: 0, limit, offset } });

    let query = supabase
      .from('incidents')
      .select('id, api_id, severity, status, title, started_at, resolved_at', { count: 'exact' })
      .in('api_id', apiIds)
      .order('started_at', { ascending: false });

    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);
    if (openOnly) query = query.neq('status', 'resolved');

    const { data: incidents, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return v1Json(
      (incidents || []).map(i => publicIncident(i, slugById[i.api_id])),
      { meta: { total: count ?? (incidents || []).length, limit, offset }, maxAge: 60 },
    );
  } catch (err) {
    console.error('[APIdown] /v1/incidents error:', err?.message || err);
    return v1Error('internal_error', 'Failed to load incidents', 500);
  }
}
