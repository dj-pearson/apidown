import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pipelineErrors, pipelineOk, describePipelineFailure } from '../src/lib/redis-results.js';

const oom = () => new Error('OOM command not allowed when used memory > maxmemory');

describe('pipelineOk', () => {
  test('accepts a fully successful pipeline', () => {
    assert.equal(pipelineOk([[null, 1], [null, 2]]), true);
  });

  test('accepts an empty pipeline', () => {
    assert.equal(pipelineOk([]), true);
  });

  test('rejects a pipeline where any command failed', () => {
    assert.equal(pipelineOk([[null, 1], [oom(), null]]), false);
    assert.equal(pipelineOk([[oom(), null]]), false);
  });

  test('rejects a discarded transaction', () => {
    // ioredis resolves to null when the whole MULTI was discarded.
    assert.equal(pipelineOk(null), false);
    assert.equal(pipelineOk(undefined), false);
  });

  test('an OOM is not silently a success — this was the bug', () => {
    assert.equal(pipelineOk([[oom(), null]]), false);
  });

  test('a READONLY replica error is caught too', () => {
    assert.equal(pipelineOk([[new Error("READONLY You can't write against a read only replica."), null]]), false);
  });
});

describe('pipelineErrors', () => {
  test('returns only the failures', () => {
    const err = oom();
    assert.deepEqual(pipelineErrors([[null, 1], [err, null], [null, 3]]), [err]);
  });

  test('returns an empty list when nothing failed', () => {
    assert.deepEqual(pipelineErrors([[null, 1]]), []);
  });

  test('tolerates a malformed result shape', () => {
    assert.deepEqual(pipelineErrors(null), []);
    assert.deepEqual(pipelineErrors(undefined), []);
    assert.deepEqual(pipelineErrors('nonsense'), []);
    assert.deepEqual(pipelineErrors([null, undefined]), []);
  });
});

describe('describePipelineFailure', () => {
  test('returns null when everything succeeded', () => {
    assert.equal(describePipelineFailure([[null, 1]]), null);
  });

  test('names the failure', () => {
    assert.match(describePipelineFailure([[oom(), null]]), /OOM/);
  });

  test('counts additional failures', () => {
    const msg = describePipelineFailure([[oom(), null], [oom(), null], [oom(), null]]);
    assert.match(msg, /and 2 more/);
  });

  test('explains a discarded transaction', () => {
    assert.match(describePipelineFailure(null), /no result/);
  });
});
