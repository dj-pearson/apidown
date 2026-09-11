import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  runDrain,
  reclaimAbandoned,
  ALERTS_QUEUE,
  PROCESSING_QUEUE,
  DEAD_LETTER_QUEUE,
  MAX_ATTEMPTS,
} from '../src/lib/alert-queue.js';

/** Just enough Redis to exercise the claim/acknowledge protocol. */
function fakeRedis(pending = []) {
  const lists = { [ALERTS_QUEUE]: [...pending], [PROCESSING_QUEUE]: [], [DEAD_LETTER_QUEUE]: [] };
  return {
    lists,
    async lmove(src, dst, from, to) {
      const source = lists[src] ||= [];
      const dest = lists[dst] ||= [];
      if (source.length === 0) return null;
      const value = from === 'LEFT' ? source.shift() : source.pop();
      if (to === 'LEFT') dest.unshift(value); else dest.push(value);
      return value;
    },
    async lrem(key, _count, value) {
      const list = lists[key] ||= [];
      const i = list.indexOf(value);
      if (i >= 0) list.splice(i, 1);
      return i >= 0 ? 1 : 0;
    },
    async rpush(key, value) {
      (lists[key] ||= []).push(value);
      return lists[key].length;
    },
  };
}

const silent = { warn: () => {}, error: () => {} };
const job = over => JSON.stringify({ incident_id: 'i1', api_slug: 'stripe', ...over });

describe('runDrain — nothing leaves the queue until it is delivered', () => {
  test('a delivered job leaves every list empty', async () => {
    const redis = fakeRedis([job()]);
    const stats = await runDrain(redis, { processJob: async () => ['sent'], log: silent });

    assert.deepEqual(redis.lists[ALERTS_QUEUE], []);
    assert.deepEqual(redis.lists[PROCESSING_QUEUE], [], 'nothing stranded mid-flight');
    assert.deepEqual(redis.lists[DEAD_LETTER_QUEUE], []);
    assert.equal(stats.acked, 1);
  });

  test('a failed send requeues the job rather than dropping it', async () => {
    const redis = fakeRedis([job()]);
    await runDrain(redis, { processJob: async () => ['failed'], log: silent });

    assert.equal(redis.lists[ALERTS_QUEUE].length, 1, 'the alert survives — this was the bug');
    assert.deepEqual(redis.lists[PROCESSING_QUEUE], []);
    assert.equal(JSON.parse(redis.lists[ALERTS_QUEUE][0]).attempts, 1);
  });

  test('a job whose handler throws is requeued, not lost', async () => {
    const redis = fakeRedis([job()]);
    await runDrain(redis, { processJob: async () => { throw new Error('boom'); }, log: silent });
    assert.equal(redis.lists[ALERTS_QUEUE].length, 1);
  });

  test('a partial failure requeues so the failed subscriber is retried', async () => {
    const redis = fakeRedis([job()]);
    await runDrain(redis, { processJob: async () => ['sent', 'failed'], log: silent });
    assert.equal(redis.lists[ALERTS_QUEUE].length, 1);
  });

  test('a job with no subscribers is acknowledged', async () => {
    const redis = fakeRedis([job()]);
    await runDrain(redis, { processJob: async () => [], log: silent });
    assert.deepEqual(redis.lists[ALERTS_QUEUE], []);
    assert.deepEqual(redis.lists[PROCESSING_QUEUE], []);
  });

  test('an unparseable job is discarded without stalling the queue behind it', async () => {
    const redis = fakeRedis(['{not json', job()]);
    const handled = [];
    const stats = await runDrain(redis, {
      processJob: async j => { handled.push(j.incident_id); return ['sent']; },
      log: silent,
    });

    assert.deepEqual(handled, ['i1'], 'the good job still ran');
    assert.deepEqual(redis.lists[ALERTS_QUEUE], []);
    assert.deepEqual(redis.lists[PROCESSING_QUEUE], []);
    assert.equal(stats.discarded, 1);
  });

  test('an empty queue is a no-op', async () => {
    const redis = fakeRedis([]);
    const stats = await runDrain(redis, { processJob: async () => ['sent'], log: silent });
    assert.equal(stats.claimed, 0);
  });

  test('processes jobs in the order they were queued', async () => {
    const redis = fakeRedis([job({ incident_id: 'first' }), job({ incident_id: 'second' })]);
    const order = [];
    await runDrain(redis, {
      processJob: async j => { order.push(j.incident_id); return ['sent']; },
      log: silent,
    });
    assert.deepEqual(order, ['first', 'second']);
  });

  test('respects the batch size and leaves the rest queued', async () => {
    const redis = fakeRedis([job(), job(), job()]);
    const stats = await runDrain(redis, { processJob: async () => ['sent'], batchSize: 2, log: silent });
    assert.equal(stats.claimed, 2);
    assert.equal(redis.lists[ALERTS_QUEUE].length, 1);
  });
});

describe('runDrain — recovery and giving up', () => {
  test('a job stranded in processing by a dead run is reclaimed and delivered', async () => {
    const redis = fakeRedis([]);
    redis.lists[PROCESSING_QUEUE] = [job()];

    let seen = 0;
    await runDrain(redis, { processJob: async () => { seen++; return ['sent']; }, log: silent });

    assert.equal(seen, 1, 'the abandoned alert was picked back up');
    assert.deepEqual(redis.lists[PROCESSING_QUEUE], []);
    assert.deepEqual(redis.lists[ALERTS_QUEUE], []);
  });

  test('reclaimed jobs go to the front, ahead of newer ones', async () => {
    const redis = fakeRedis([job({ incident_id: 'newer' })]);
    redis.lists[PROCESSING_QUEUE] = [job({ incident_id: 'stranded' })];

    const order = [];
    await runDrain(redis, {
      processJob: async j => { order.push(j.incident_id); return ['sent']; },
      log: silent,
    });
    assert.deepEqual(order, ['stranded', 'newer']);
  });

  test('reclaimAbandoned returns how many it moved', async () => {
    const redis = fakeRedis([]);
    redis.lists[PROCESSING_QUEUE] = [job(), job()];
    assert.equal(await reclaimAbandoned(redis), 2);
    assert.equal(redis.lists[ALERTS_QUEUE].length, 2);
  });

  test('a job that always fails is dead-lettered instead of looping forever', async () => {
    const redis = fakeRedis([job()]);
    let runs = 0;
    for (let i = 0; i < MAX_ATTEMPTS + 3 && redis.lists[ALERTS_QUEUE].length > 0; i++) {
      await runDrain(redis, { processJob: async () => { runs++; return ['failed']; }, log: silent });
    }

    assert.deepEqual(redis.lists[ALERTS_QUEUE], [], 'stopped retrying');
    assert.deepEqual(redis.lists[PROCESSING_QUEUE], []);
    assert.equal(redis.lists[DEAD_LETTER_QUEUE].length, 1, 'kept for inspection, not dropped');
    assert.equal(runs, MAX_ATTEMPTS, `should try exactly ${MAX_ATTEMPTS} times`);
  });

  test('a job that fails then succeeds is delivered and acknowledged', async () => {
    const redis = fakeRedis([job()]);
    let calls = 0;
    await runDrain(redis, { processJob: async () => { calls++; return ['failed']; }, log: silent });
    await runDrain(redis, { processJob: async () => { calls++; return ['sent']; }, log: silent });

    assert.equal(calls, 2);
    assert.deepEqual(redis.lists[ALERTS_QUEUE], []);
    assert.deepEqual(redis.lists[DEAD_LETTER_QUEUE], []);
  });
});
