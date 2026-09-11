import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyPatchSet,
  withPatch,
  mergePatches,
  mergeRow,
  emptyOverride,
  withOverride,
  resolveOverride,
  emptyAdditions,
  withAddition,
  mergeAdditions,
  additionCount,
} from '../src/lib/live-patch.js';

const load = () => [
  { id: 1, name: 'Stripe', current_status: 'operational' },
  { id: 2, name: 'OpenAI', current_status: 'operational' },
];

describe('mergePatches', () => {
  test('returns the source untouched when there are no patches', () => {
    const rows = load();
    assert.equal(mergePatches(rows, emptyPatchSet()), rows);
  });

  test('applies a patch to the matching row only', () => {
    const rows = load();
    const patches = withPatch(emptyPatchSet(), rows, { id: 2, current_status: 'down' });
    const merged = mergePatches(rows, patches);
    assert.equal(merged[0].current_status, 'operational');
    assert.equal(merged[1].current_status, 'down');
  });

  test('keeps fields the patch does not mention', () => {
    const rows = load();
    const patches = withPatch(emptyPatchSet(), rows, { id: 1, current_status: 'degraded' });
    assert.equal(mergePatches(rows, patches)[0].name, 'Stripe');
  });

  test('does not mutate the source rows', () => {
    const rows = load();
    mergePatches(rows, withPatch(emptyPatchSet(), rows, { id: 1, current_status: 'down' }));
    assert.equal(rows[0].current_status, 'operational');
  });

  test('discards patches belonging to a superseded load payload', () => {
    const first = load();
    const patches = withPatch(emptyPatchSet(), first, { id: 1, current_status: 'down' });

    // load() runs again and returns a fresh array — the stale patch must not win.
    const second = load();
    assert.deepEqual(mergePatches(second, patches), second);
  });

  test('handles a null or empty source', () => {
    assert.deepEqual(mergePatches(null, emptyPatchSet()), []);
    assert.deepEqual(mergePatches([], emptyPatchSet()), []);
  });

  test('ignores a patch for an id that is not in the list', () => {
    const rows = load();
    const patches = withPatch(emptyPatchSet(), rows, { id: 99, current_status: 'down' });
    assert.deepEqual(mergePatches(rows, patches), rows.map(r => ({ ...r })));
  });

  test('supports a non-default key', () => {
    const rows = [{ slug: 'stripe', current_status: 'operational' }];
    const patches = withPatch(emptyPatchSet(), rows, { slug: 'stripe', current_status: 'down' }, 'slug');
    assert.equal(mergePatches(rows, patches, 'slug')[0].current_status, 'down');
  });
});

describe('withPatch', () => {
  test('accumulates patches across several rows', () => {
    const rows = load();
    let patches = withPatch(emptyPatchSet(), rows, { id: 1, current_status: 'down' });
    patches = withPatch(patches, rows, { id: 2, current_status: 'degraded' });
    const merged = mergePatches(rows, patches);
    assert.deepEqual(merged.map(r => r.current_status), ['down', 'degraded']);
  });

  test('a later patch for the same row merges over the earlier one', () => {
    const rows = load();
    let patches = withPatch(emptyPatchSet(), rows, { id: 1, current_status: 'down', note: 'first' });
    patches = withPatch(patches, rows, { id: 1, current_status: 'operational' });
    const row = mergePatches(rows, patches)[0];
    assert.equal(row.current_status, 'operational');
    assert.equal(row.note, 'first', 'fields the newer patch omits should survive');
  });

  test('starts a fresh set when the load payload changes', () => {
    const first = load();
    let patches = withPatch(emptyPatchSet(), first, { id: 1, current_status: 'down' });
    const second = load();
    patches = withPatch(patches, second, { id: 2, current_status: 'degraded' });

    assert.equal(patches.byId.size, 1, 'the old payload\'s patches are dropped');
    assert.deepEqual(mergePatches(second, patches).map(r => r.current_status), ['operational', 'degraded']);
  });

  test('returns the set unchanged for a row with no key', () => {
    const rows = load();
    const set = emptyPatchSet();
    assert.equal(withPatch(set, rows, { current_status: 'down' }), set);
    assert.equal(withPatch(set, rows, null), set);
  });

  test('never mutates the set it is given', () => {
    const rows = load();
    const set = emptyPatchSet();
    withPatch(set, rows, { id: 1, current_status: 'down' });
    assert.equal(set.byId.size, 0);
  });

  test('tolerates a null patch set', () => {
    const rows = load();
    const patches = withPatch(null, rows, { id: 1, current_status: 'down' });
    assert.equal(mergePatches(rows, patches)[0].current_status, 'down');
  });
});

describe('mergeRow', () => {
  const row = () => ({ id: 1, name: 'Stripe', current_status: 'operational' });

  test('returns the source untouched with no patches', () => {
    const r = row();
    assert.equal(mergeRow(r, emptyPatchSet()), r);
  });

  test('applies a patch tagged to that exact row object', () => {
    const r = row();
    const patches = withPatch(emptyPatchSet(), r, { id: 1, current_status: 'down' });
    assert.equal(mergeRow(r, patches).current_status, 'down');
  });

  test('keeps fields the patch omits and does not mutate the source', () => {
    const r = row();
    const merged = mergeRow(r, withPatch(emptyPatchSet(), r, { id: 1, current_status: 'down' }));
    assert.equal(merged.name, 'Stripe');
    assert.equal(r.current_status, 'operational');
  });

  test('drops a patch made against a superseded payload', () => {
    const first = row();
    const patches = withPatch(emptyPatchSet(), first, { id: 1, current_status: 'down' });
    const second = row();
    assert.equal(mergeRow(second, patches).current_status, 'operational');
  });

  test('ignores a patch for a different id', () => {
    const r = row();
    const patches = withPatch(emptyPatchSet(), r, { id: 2, current_status: 'down' });
    assert.equal(mergeRow(r, patches), r);
  });

  test('passes a null source straight through', () => {
    assert.equal(mergeRow(null, emptyPatchSet()), null);
  });
});

describe('overrides', () => {
  test('an empty override falls back to the server value', () => {
    const data = { isPinned: false };
    assert.equal(resolveOverride(emptyOverride(), data, data.isPinned), false);
  });

  test('an override made against the current payload wins', () => {
    const data = { isPinned: false };
    const o = withOverride(data, true);
    assert.equal(resolveOverride(o, data, data.isPinned), true);
  });

  test('a false override still wins over a true server value', () => {
    const data = { isPinned: true };
    assert.equal(resolveOverride(withOverride(data, false), data, data.isPinned), false);
  });

  test('the override expires when load() returns a new payload', () => {
    const first = { isPinned: false };
    const o = withOverride(first, true);
    const second = { isPinned: false };
    assert.equal(resolveOverride(o, second, second.isPinned), false);
  });

  test('tolerates a null override', () => {
    const data = { latencyRange: '7d' };
    assert.equal(resolveOverride(null, data, data.latencyRange), '7d');
  });
});

describe('additions', () => {
  const feed = () => [{ key: 'a' }, { key: 'b' }];

  test('an empty set leaves the feed untouched', () => {
    const rows = feed();
    assert.equal(mergeAdditions(rows, emptyAdditions(), { key: 'key' }), rows);
  });

  test('puts a new row at the front', () => {
    const rows = feed();
    const adds = withAddition(emptyAdditions(), rows, { key: 'c' }, 'key');
    assert.deepEqual(mergeAdditions(rows, adds, { key: 'key' }).map(r => r.key), ['c', 'a', 'b']);
  });

  test('newest addition leads', () => {
    const rows = feed();
    let adds = withAddition(emptyAdditions(), rows, { key: 'c' }, 'key');
    adds = withAddition(adds, rows, { key: 'd' }, 'key');
    assert.deepEqual(mergeAdditions(rows, adds, { key: 'key' }).map(r => r.key), ['d', 'c', 'a', 'b']);
  });

  test('ignores a duplicate of a row already added', () => {
    const rows = feed();
    let adds = withAddition(emptyAdditions(), rows, { key: 'c' }, 'key');
    adds = withAddition(adds, rows, { key: 'c' }, 'key');
    assert.equal(adds.rows.length, 1);
  });

  test('drops an addition the server payload now contains', () => {
    const rows = feed();
    const adds = withAddition(emptyAdditions(), rows, { key: 'c' }, 'key');
    const refreshed = [{ key: 'c' }, ...feed()];
    // Same payload identity check applies first, but even tagged to it the
    // duplicate must not appear twice.
    const tagged = withAddition(emptyAdditions(), refreshed, { key: 'c' }, 'key');
    assert.deepEqual(mergeAdditions(refreshed, tagged, { key: 'key' }).map(r => r.key), ['c', 'a', 'b']);
    assert.deepEqual(mergeAdditions(refreshed, adds, { key: 'key' }).map(r => r.key), ['c', 'a', 'b']);
  });

  test('discards additions made against a superseded payload', () => {
    const first = feed();
    const adds = withAddition(emptyAdditions(), first, { key: 'c' }, 'key');
    const second = feed();
    assert.deepEqual(mergeAdditions(second, adds, { key: 'key' }).map(r => r.key), ['a', 'b']);
  });

  test('respects the cap, with and without additions', () => {
    const rows = feed();
    const adds = withAddition(emptyAdditions(), rows, { key: 'c' }, 'key');
    assert.deepEqual(mergeAdditions(rows, adds, { key: 'key', limit: 2 }).map(r => r.key), ['c', 'a']);
    assert.deepEqual(mergeAdditions(rows, emptyAdditions(), { key: 'key', limit: 1 }).map(r => r.key), ['a']);
  });

  test('never mutates the set or the source', () => {
    const rows = feed();
    const set = emptyAdditions();
    withAddition(set, rows, { key: 'c' }, 'key');
    assert.equal(set.rows.length, 0);
    assert.equal(rows.length, 2);
  });

  test('ignores a row with no key', () => {
    const rows = feed();
    const set = emptyAdditions();
    assert.equal(withAddition(set, rows, {}, 'key'), set);
    assert.equal(withAddition(set, rows, null, 'key'), set);
  });

  test('additionCount counts only what is actually shown', () => {
    const rows = feed();
    let adds = withAddition(emptyAdditions(), rows, { key: 'c' }, 'key');
    adds = withAddition(adds, rows, { key: 'd' }, 'key');
    assert.equal(additionCount(rows, adds, 'key'), 2);

    const second = feed();
    assert.equal(additionCount(second, adds, 'key'), 0, 'superseded payload resets the count');
    assert.equal(additionCount(rows, emptyAdditions(), 'key'), 0);
  });

  test('additionCount excludes rows the server has caught up on', () => {
    const rows = feed();
    const adds = withAddition(emptyAdditions(), rows, { key: 'a' }, 'key');
    assert.equal(additionCount(rows, adds, 'key'), 0);
  });
});
