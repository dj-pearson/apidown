/**
 * Head-to-head comparison pairing.
 *
 * /compare/[slug1]/vs/[slug2] renders the same data whichever way round the two
 * slugs are given, so every pair gets exactly one canonical URL: the two slugs
 * in ascending order. Everything that links to or lists a comparison goes
 * through here, so the sitemap, the API detail pages and the /compare hub all
 * agree on that one URL and search engines never see the pair twice.
 */

/** Ascending slug order — the canonical orientation for a pair. */
export function orderPair(slugA, slugB) {
  const a = String(slugA || '');
  const b = String(slugB || '');
  return a <= b ? [a, b] : [b, a];
}

/** True when the two slugs are already in canonical order. */
export function isCanonicalOrder(slugA, slugB) {
  return String(slugA || '') <= String(slugB || '');
}

/** Canonical path for a head-to-head, regardless of the order given. */
export function comparePath(slugA, slugB) {
  const [lo, hi] = orderPair(slugA, slugB);
  return `/compare/${lo}/vs/${hi}`;
}

/**
 * Rank a candidate peer for comparison against `api`. Higher sorts first.
 * Same category is the whole point of a head-to-head; among those, prefer
 * peers whose status differs (a live "one of these is down" comparison is
 * the interesting one) and then fall back to alphabetical for stability.
 */
function peerRank(api, peer) {
  let rank = 0;
  if (peer.category && peer.category === api.category) rank += 100;
  if (peer.current_status && api.current_status && peer.current_status !== api.current_status) rank += 10;
  if (peer.current_status && peer.current_status !== 'operational') rank += 5;
  return rank;
}

/**
 * Peers worth comparing `slug` against, best first.
 * Only community-tracked APIs (no owner_id) make sensible public comparisons.
 */
export function peersForApi(slug, apis, limit = 4) {
  const list = (apis || []).filter(a => a && a.slug);
  const api = list.find(a => a.slug === slug);
  if (!api) return [];

  return list
    .filter(a => a.slug !== slug && !a.owner_id)
    .map(a => ({ api: a, rank: peerRank(api, a) }))
    .filter(x => x.rank >= 100) // same category only
    .sort((x, y) => y.rank - x.rank || x.api.slug.localeCompare(y.api.slug))
    .slice(0, Math.max(0, limit))
    .map(x => ({ ...x.api, comparePath: comparePath(slug, x.api.slug) }));
}

/**
 * Every canonical same-category pair, capped per category so the sitemap
 * cannot explode combinatorially (a 12-API category is 66 pairs on its own).
 * Deterministic: alphabetical within each category, categories alphabetical.
 */
export function allComparePairs(apis, { perCategory = 15 } = {}) {
  const byCategory = new Map();
  for (const a of apis || []) {
    if (!a || !a.slug || !a.category || a.owner_id) continue;
    if (!byCategory.has(a.category)) byCategory.set(a.category, []);
    byCategory.get(a.category).push(a.slug);
  }

  const pairs = [];
  for (const category of [...byCategory.keys()].sort()) {
    const slugs = [...new Set(byCategory.get(category))].sort();
    const catPairs = [];
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        catPairs.push([slugs[i], slugs[j]]);
      }
    }
    pairs.push(...catPairs.slice(0, Math.max(0, perCategory)));
  }
  return pairs;
}

/**
 * A short, human-facing list of head-to-heads for the /compare hub, grouped by
 * category so the page reads as a directory rather than a wall of links.
 */
export function featuredComparisons(apis, { perCategory = 6, maxCategories = 8 } = {}) {
  const nameBySlug = new Map((apis || []).filter(a => a?.slug).map(a => [a.slug, a.name || a.slug]));
  const grouped = new Map();

  for (const [a, b] of allComparePairs(apis, { perCategory: Number.MAX_SAFE_INTEGER })) {
    const category = (apis || []).find(x => x.slug === a)?.category;
    if (!category) continue;
    if (!grouped.has(category)) grouped.set(category, []);
    const bucket = grouped.get(category);
    if (bucket.length >= perCategory) continue;
    bucket.push({
      category,
      a: { slug: a, name: nameBySlug.get(a) || a },
      b: { slug: b, name: nameBySlug.get(b) || b },
      path: comparePath(a, b),
    });
  }

  return [...grouped.entries()]
    .filter(([, v]) => v.length > 0)
    .sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0]))
    .slice(0, maxCategories)
    .map(([category, comparisons]) => ({ category, comparisons }));
}
