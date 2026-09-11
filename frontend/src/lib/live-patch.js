/**
 * Overlaying realtime updates on server-loaded lists.
 *
 * Pages that subscribe to Supabase realtime need two things at once: the list
 * that `load()` returned, and the row updates that have arrived since. Holding
 * the list in `$state` and mutating it satisfies the second but breaks the
 * first — SvelteKit reuses the component across navigations and invalidations,
 * so the page keeps rendering whichever payload it happened to mount with.
 *
 * Instead the list stays derived from `data`, and the patches live beside it in
 * a set tagged with the exact array they were applied over. When `load()`
 * returns a new array the tag no longer matches and the patches are dropped, so
 * an old realtime row can never mask fresher server data.
 */

/** An empty patch set, belonging to no load payload yet. */
export function emptyPatchSet() {
  return { source: null, byId: new Map() };
}

/**
 * Record a realtime row against the load payload currently on screen.
 * Returns a new patch set — assign it to `$state` to trigger a re-render.
 */
export function withPatch(patches, source, row, key = 'id') {
  const set = patches || emptyPatchSet();
  if (!row || row[key] === undefined || row[key] === null) return set;

  // A patch set only ever belongs to one load payload; a new one starts fresh.
  const byId = set.source === source ? new Map(set.byId) : new Map();
  byId.set(row[key], { ...(byId.get(row[key]) || {}), ...row });
  return { source, byId };
}

/**
 * The list as the user should see it: `source` with any patches that belong to
 * this exact payload merged in. Patches for a superseded payload are ignored.
 */
export function mergePatches(source, patches, key = 'id') {
  const rows = source || [];
  if (!patches || patches.source !== source || patches.byId.size === 0) return rows;
  return rows.map(row => {
    const patch = patches.byId.get(row[key]);
    return patch ? { ...row, ...patch } : row;
  });
}

/**
 * The single-row form of `mergePatches`, for pages that render one record
 * (an API detail page) rather than a list. `source` must be the object from
 * `data` itself, so its identity can tag the patches that belong to it.
 */
export function mergeRow(source, patches, key = 'id') {
  if (!source) return source;
  if (!patches || patches.source !== source) return source;
  const patch = patches.byId.get(source[key]);
  return patch ? { ...source, ...patch } : source;
}

/**
 * A local override — an optimistic UI change the user made, such as toggling a
 * pin or picking a chart range — tagged with the load payload it was made
 * against. It shows immediately and is dropped once `load()` returns, at which
 * point the server's value is authoritative again.
 */
export function emptyOverride() {
  return { source: null, value: undefined };
}

/** Record an override against the payload currently on screen. */
export function withOverride(source, value) {
  return { source, value };
}

/** The override if it still belongs to `source`, otherwise the server value. */
export function resolveOverride(override, source, fallback) {
  return override && override.source === source ? override.value : fallback;
}

/**
 * Rows that arrived live and are not in the server payload at all — a new
 * incident appearing in a feed, say. Same tagging rule as the others: they sit
 * in front of `source` until `load()` returns, at which point the server list
 * already contains them and the local copies are dropped.
 */
export function emptyAdditions() {
  return { source: null, rows: [] };
}

/** Add a row to the front, ignoring one whose key is already present. */
export function withAddition(additions, source, row, key = 'id') {
  const set = additions || emptyAdditions();
  if (!row || row[key] === undefined || row[key] === null) return set;

  const rows = set.source === source ? set.rows : [];
  if (rows.some(r => r[key] === row[key])) return set.source === source ? set : { source, rows };
  return { source, rows: [row, ...rows] };
}

/**
 * `source` with any additions that belong to it in front, de-duplicated
 * against the server rows and capped.
 */
export function mergeAdditions(source, additions, { key = 'id', limit = Infinity } = {}) {
  const base = source || [];
  if (!additions || additions.source !== source || additions.rows.length === 0) {
    return limit < base.length ? base.slice(0, limit) : base;
  }
  const seen = new Set(base.map(r => r[key]));
  const added = additions.rows.filter(r => !seen.has(r[key]));
  return added.length ? [...added, ...base].slice(0, limit) : (limit < base.length ? base.slice(0, limit) : base);
}

/** How many additions currently apply — for counters shown beside a feed. */
export function additionCount(source, additions, key = 'id') {
  if (!additions || additions.source !== source) return 0;
  const seen = new Set((source || []).map(r => r[key]));
  return additions.rows.filter(r => !seen.has(r[key])).length;
}
