import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMissingRpc } from '../src/lib/synthetic-probe.js';

test('isMissingRpc: the error PostgREST actually returns for a missing function', () => {
  // Verbatim from the production worker log, 2026-10-24.
  assert.equal(isMissingRpc({
    code: 'PGRST202',
    message: 'Could not find the function public.get_sdk_coverage_apis(p_min_reporters, p_min_signals, p_minutes) in the schema cache',
  }), true);
  assert.equal(isMissingRpc({ message: 'Could not find the function public.x() in the schema cache' }), true);
  assert.equal(isMissingRpc({ code: '42883', message: 'function public.x() does not exist' }), true);
});

test('isMissingRpc: other failures are not mistaken for a missing function', () => {
  assert.equal(isMissingRpc(null), false);
  assert.equal(isMissingRpc({ code: '57014', message: 'canceling statement due to statement timeout' }), false);
  assert.equal(isMissingRpc({ message: 'TypeError: fetch failed' }), false);
  assert.equal(isMissingRpc({ code: '42P01', message: 'relation "signals" does not exist' }), false);
});
