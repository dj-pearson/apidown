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
