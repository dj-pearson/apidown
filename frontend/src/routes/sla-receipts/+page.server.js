import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { monthWindow, recentMonthKeys, uptimePctInWindow, downtimeMsInWindow } from '$lib/api-history.js';

/**
 * SLA receipts: vendor's published uptime commitment vs. what APIdown measured
 * last full calendar month. Uses the previous complete month so every row is
 * comparable — a partial month would flatter whoever is early in it.
 */
export async function load({ setHeaders }) {
  setHeaders({ 'cache-control': 'public, max-age=1800, s-maxage=3600' });

  const now = Date.now();

  // recentMonthKeys[0] is the current (incomplete) month, so take [1].
  const monthKeyToReport = recentMonthKeys(2, now)[1];
  const { start, end, label } = monthWindow(monthKeyToReport);
  const empty = { month: monthKeyToReport, monthLabel: label, scored: [], unscored: [], noTarget: [] };

  try {
    const supabase = getSupabaseAdmin();

    const { data: apis } = await supabase
      .from('apis')
      .select('id, slug, name, category, published_sla_pct, published_sla_url, published_sla_note')
      .is('owner_id', null)
      .order('name');

    const apiList = apis || [];
    if (apiList.length === 0) return empty;

    const { data: incidents } = await supabase
      .from('incidents')
      .select('api_id, started_at, resolved_at')
      .lt('started_at', new Date(end).toISOString())
      .or(`resolved_at.gte.${new Date(start).toISOString()},resolved_at.is.null`);

    const byApi = new Map();
    for (const inc of incidents || []) {
      if (!byApi.has(inc.api_id)) byApi.set(inc.api_id, []);
      byApi.get(inc.api_id).push(inc);
    }

    const rows = apiList.map(api => {
      const apiIncidents = byApi.get(api.id) || [];
      const measured = uptimePctInWindow(apiIncidents, start, end, now);
      const target = api.published_sla_pct === null || api.published_sla_pct === undefined
        ? null
        : Number(api.published_sla_pct);

      return {
        slug: api.slug,
        name: api.name,
        category: api.category,
        target,
        targetUrl: api.published_sla_url || null,
        targetNote: api.published_sla_note || null,
        measured,
        downtimeMs: downtimeMsInWindow(apiIncidents, start, end, now),
        incidentCount: apiIncidents.length,
        // Positive shortfall means the vendor came in under its own commitment.
        shortfall: target !== null && measured !== null
          ? Math.round((target - measured) * 1000) / 1000
          : null,
        met: target !== null && measured !== null ? measured >= target : null,
      };
    });

    const withTarget = rows.filter(r => r.target !== null);

    return {
      month: monthKeyToReport,
      monthLabel: label,
      // Misses first, largest shortfall at the top — that's the interesting part.
      scored: withTarget
        .filter(r => r.measured !== null)
        .sort((a, b) => (b.shortfall ?? -Infinity) - (a.shortfall ?? -Infinity)),
      unscored: withTarget.filter(r => r.measured === null),
      noTarget: rows.filter(r => r.target === null),
    };
  } catch (err) {
    // A public SEO page should degrade to an empty state, not a 500.
    console.error('[APIdown] SLA receipts load error:', err?.message || err);
    return empty;
  }
}
