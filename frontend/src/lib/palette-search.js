/**
 * Ranking logic for the command palette, kept out of the component so it can be
 * unit tested. The component owns only the keyboard and focus behaviour.
 */

import { categoryLabel } from './categories.js';

export const PALETTE_PAGES = [
  { label: 'Status Dashboard', href: '/', keywords: 'home status grid all apis' },
  { label: 'My Stack', href: '/stack', keywords: 'watchlist favorites personal my stack' },
  { label: 'Live Radar', href: '/live', keywords: 'live radar feed realtime firehose monitor' },
  { label: 'Incidents', href: '/incidents', keywords: 'incidents outages history' },
  { label: 'Leaderboard', href: '/leaderboard', keywords: 'leaderboard ranking reliability grades' },
  { label: 'Compare APIs', href: '/compare', keywords: 'compare versus alternatives' },
  { label: 'Documentation', href: '/docs', keywords: 'docs sdk integration api reference' },
  { label: 'SLA Receipts', href: '/sla-receipts', keywords: 'sla receipts uptime promise missed target' },
  { label: 'Open Data', href: '/data', keywords: 'data download csv json dataset export' },
  { label: 'Weekly Report', href: '/weekly', keywords: 'weekly digest report newsletter api weather summary' },
  { label: 'Pricing', href: '/pricing', keywords: 'pricing plans upgrade billing' },
  { label: 'Dashboard', href: '/dashboard', keywords: 'dashboard account alerts subscriptions' },
];

const MAX_RESULTS = 40;

/**
 * Subsequence match — every character of the needle must appear in order.
 * Exact and prefix matches score highest so typing "str" surfaces Stripe first.
 * Returns -1 for no match.
 */
export function score(needle, haystack) {
  if (!needle) return 0;
  const h = String(haystack ?? '').toLowerCase();
  const n = needle.toLowerCase();
  if (!h) return -1;
  if (h === n) return 1000;
  if (h.startsWith(n)) return 900 - h.length;
  const idx = h.indexOf(n);
  if (idx !== -1) return 700 - idx - h.length * 0.1;

  let hi = 0;
  for (const ch of n) {
    hi = h.indexOf(ch, hi);
    if (hi === -1) return -1;
    hi++;
  }
  return 400 - h.length * 0.1;
}

/**
 * Ranked palette results for a query.
 * @param {string} query
 * @param {Array<{slug: string, name: string, category?: string, current_status?: string}>} apis
 */
export function paletteResults(query, apis = []) {
  const items = [];

  for (const api of apis) {
    const best = Math.max(
      score(query, api.name),
      score(query, api.slug),
      score(query, categoryLabel(api.category)),
    );

    // Scored separately so "stripe history" reaches the archive even though that
    // query matches neither the API name nor its slug on its own.
    const historyBest = Math.max(
      score(query, `${api.name} outage history`),
      score(query, `${api.slug} history`),
    );

    if (best < 0 && historyBest < 0) continue;

    if (best >= 0) {
      items.push({
        kind: 'api',
        label: api.name,
        hint: categoryLabel(api.category),
        status: api.current_status || 'operational',
        href: `/api/${api.slug}`,
        score: best,
      });
    }

    items.push({
      kind: 'history',
      label: `${api.name} — outage history`,
      hint: 'Archive',
      href: `/api/${api.slug}/history`,
      // Below the status page on a bare name, but wins when the query says
      // "history".
      score: best >= 0 ? Math.max(best - 120, historyBest) : historyBest,
    });
  }

  for (const p of PALETTE_PAGES) {
    const best = Math.max(score(query, p.label), score(query, p.keywords));
    if (best < 0) continue;
    // Pages rank below a same-strength API match: people search APIs far more.
    items.push({ kind: 'page', label: p.label, hint: 'Page', href: p.href, score: best - 50 });
  }

  items.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return items.slice(0, MAX_RESULTS);
}
