import { error } from '@sveltejs/kit';
import { getSupabaseAdmin } from '$lib/supabase-server.js';
import {
  isValidMonthKey,
  monthWindow,
  uptimePctInWindow,
  downtimeMsInWindow,
  longestOutageMsInWindow,
} from '$lib/api-history.js';

/** Dated permalink for one API's incidents in one month, e.g. /api/stripe/history/2026-07 */
export async function load({ params, setHeaders }) {
  if (!isValidMonthKey(params.month)) {
    throw error(404, 'Not a valid month — expected YYYY-MM');
  }

  const { start, end, label } = monthWindow(params.month);
  const now = Date.now();

  if (start > now) throw error(404, `${label} hasn't happened yet`);

  // Past months never change; the current month keeps a short cache.
  const isCurrent = end > now;
  setHeaders({
    'cache-control': isCurrent
      ? 'public, max-age=300, s-maxage=600'
      : 'public, max-age=3600, s-maxage=86400',
  });

  const supabase = getSupabaseAdmin();

  const { data: api } = await supabase
    .from('apis')
    .select('id, slug, name, category, current_status')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!api) throw error(404, 'API not found');

  // Any incident that overlaps the month: started before the month ended and
  // either resolved after it started or is still open.
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, severity, status, title, started_at, resolved_at')
    .eq('api_id', api.id)
    .lt('started_at', new Date(end).toISOString())
    .or(`resolved_at.gte.${new Date(start).toISOString()},resolved_at.is.null`)
    .order('started_at', { ascending: false });

  const inMonth = (incidents || []).filter(inc => {
    const s = new Date(inc.started_at).getTime();
    const e = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;
    return s < end && e > start;
  });

  // Adjacent months for prev/next navigation, bounded by "not the future".
  const [y, m] = params.month.split('-').map(Number);
  const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const nextKey = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const nextStart = monthWindow(nextKey).start;

  return {
    api: { slug: api.slug, name: api.name, category: api.category, status: api.current_status },
    month: params.month,
    monthLabel: label,
    isCurrentMonth: isCurrent,
    incidents: inMonth,
    uptimePct: uptimePctInWindow(inMonth, start, end, now),
    downtimeMs: downtimeMsInWindow(inMonth, start, end, now),
    longestOutageMs: longestOutageMsInWindow(inMonth, start, end, now),
    prevMonth: prevKey,
    nextMonth: nextStart <= now ? nextKey : null,
  };
}
