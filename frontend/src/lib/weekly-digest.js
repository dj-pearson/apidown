/**
 * "API Weather Report" — the weekly digest.
 *
 * Deterministic for a given ISO week so the /weekly archive stays stable: the
 * same week key always produces the same window and the same ordering.
 */

import { categoryLabel } from './categories.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** ISO-8601 week key, e.g. "2026-W31". */
export function weekKey(date) {
  const d = new Date(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday of the current ISO week determines the year the week belongs to.
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((target - firstThursday) / WEEK_MS);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function isValidWeekKey(key) {
  if (!/^\d{4}-W\d{2}$/.test(key || '')) return false;
  const [y, w] = key.split('-W').map(Number);
  return y >= 2024 && y <= 2100 && w >= 1 && w <= 53;
}

/** UTC Monday 00:00 → next Monday 00:00 for an ISO week key. */
export function weekWindow(key) {
  const [year, week] = key.split('-W').map(Number);
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  const week1Monday = new Date(firstThursday.getTime() - firstDayNum * DAY_MS);
  const start = week1Monday.getTime() + (week - 1) * WEEK_MS;
  const end = start + WEEK_MS;

  const fmt = (t) =>
    new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  return { start, end, label: `${fmt(start)} — ${fmt(end - DAY_MS)}` };
}

/** Descending list of week keys ending with the most recent complete week. */
export function recentWeekKeys(count, now = Date.now()) {
  const keys = [];
  // Step back one week so the newest entry is a week that has finished.
  let t = now - WEEK_MS;
  for (let i = 0; i < count; i++) {
    keys.push(weekKey(t));
    t -= WEEK_MS;
  }
  return keys;
}

export function previousWeekKey(key) {
  const { start } = weekWindow(key);
  return weekKey(start - WEEK_MS);
}

export function nextWeekKey(key) {
  const { end } = weekWindow(key);
  return weekKey(end + DAY_MS);
}

function durationMinutes(inc, windowStart, windowEnd, now) {
  const s = Math.max(new Date(inc.started_at).getTime(), windowStart);
  const e = Math.min(inc.resolved_at ? new Date(inc.resolved_at).getTime() : now, windowEnd);
  return e > s ? Math.round((e - s) / 60000) : 0;
}

/**
 * Builds the digest from raw rows. Pure — no I/O — so it can be rendered on the
 * web, sent as email, or unit tested with fixtures.
 *
 * @param {object} input
 * @param {string} input.week                'YYYY-Www'
 * @param {Array}  input.apis                [{ id, slug, name, category }]
 * @param {Array}  input.incidents           incidents overlapping this week
 * @param {Array}  input.latencyThisWeek     [{ api_id, p95_ms, total_signals }]
 * @param {Array}  input.latencyPriorWeek    same shape, the week before
 */
export function buildDigest({ week, apis = [], incidents = [], latencyThisWeek = [], latencyPriorWeek = [], now = Date.now() }) {
  const { start, end, label } = weekWindow(week);
  const clipEnd = Math.min(end, now);

  const apiById = new Map(apis.map(a => [a.id, a]));

  // ── Outages, longest first ──
  const outages = [];
  for (const inc of incidents) {
    const api = apiById.get(inc.api_id);
    if (!api) continue;
    const mins = durationMinutes(inc, start, clipEnd, now);
    if (mins <= 0) continue;
    outages.push({
      incidentId: inc.id,
      apiSlug: api.slug,
      apiName: api.name,
      category: api.category,
      categoryLabel: categoryLabel(api.category),
      severity: inc.severity,
      title: inc.title,
      startedAt: inc.started_at,
      resolvedAt: inc.resolved_at || null,
      durationMinutes: mins,
    });
  }
  // Stable ordering: longest first, then by name so ties never reshuffle.
  outages.sort((a, b) => b.durationMinutes - a.durationMinutes || a.apiName.localeCompare(b.apiName));

  // ── Latency movement week over week ──
  const weighted = (rows) => {
    const agg = new Map();
    for (const r of rows) {
      const a = agg.get(r.api_id) || { signals: 0, p95: 0 };
      const n = r.total_signals || 0;
      a.signals += n;
      a.p95 += (r.p95_ms || 0) * n;
      agg.set(r.api_id, a);
    }
    const out = new Map();
    for (const [id, a] of agg) {
      if (a.signals > 0) out.set(id, Math.round(a.p95 / a.signals));
    }
    return out;
  };

  const thisWeek = weighted(latencyThisWeek);
  const priorWeek = weighted(latencyPriorWeek);

  const movements = [];
  for (const [apiId, current] of thisWeek) {
    const before = priorWeek.get(apiId);
    const api = apiById.get(apiId);
    if (!api || !before || before <= 0) continue;
    const changePct = Math.round(((current - before) / before) * 1000) / 10;
    // Ignore noise; only movement a human would notice.
    if (Math.abs(changePct) < 10) continue;
    movements.push({
      apiSlug: api.slug,
      apiName: api.name,
      p95Before: before,
      p95Now: current,
      changePct,
    });
  }

  const regressions = [...movements]
    .filter(m => m.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct || a.apiName.localeCompare(b.apiName));
  const improvements = [...movements]
    .filter(m => m.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct || a.apiName.localeCompare(b.apiName));

  // ── Incidents by category ──
  const byCategory = new Map();
  for (const o of outages) {
    const entry = byCategory.get(o.category) || { category: o.category, label: o.categoryLabel, count: 0, downtimeMinutes: 0 };
    entry.count += 1;
    entry.downtimeMinutes += o.durationMinutes;
    byCategory.set(o.category, entry);
  }
  const categories = [...byCategory.values()].sort(
    (a, b) => b.downtimeMinutes - a.downtimeMinutes || a.label.localeCompare(b.label),
  );

  const totalDowntime = outages.reduce((sum, o) => sum + o.durationMinutes, 0);
  const apisAffected = new Set(outages.map(o => o.apiSlug)).size;

  // ── Clean sheet: tracked APIs with no recorded incident this week ──
  const affected = new Set(outages.map(o => o.apiSlug));
  const cleanSheet = apis
    .filter(a => !affected.has(a.slug))
    .map(a => ({ slug: a.slug, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const headline = outages.length === 0
    ? `A quiet week — no outages recorded across ${apis.length} tracked APIs.`
    : `${outages.length} ${outages.length === 1 ? 'incident' : 'incidents'} across ${apisAffected} ${apisAffected === 1 ? 'API' : 'APIs'}, ${formatMinutes(totalDowntime)} of downtime in total.`;

  return {
    week,
    weekLabel: label,
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(end).toISOString(),
    headline,
    totals: {
      incidents: outages.length,
      apisAffected,
      downtimeMinutes: totalDowntime,
      apisTracked: apis.length,
    },
    biggestOutages: outages.slice(0, 5),
    regressions: regressions.slice(0, 5),
    improvements: improvements.slice(0, 5),
    categories,
    cleanSheetCount: cleanSheet.length,
    cleanSheet: cleanSheet.slice(0, 12),
  };
}

export function formatMinutes(mins) {
  if (!mins) return '0m';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}
