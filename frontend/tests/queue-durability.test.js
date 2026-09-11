import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Redis holds the signal and alert queues — accepted customer data that has
 * not yet been written to Postgres or delivered. An evicting maxmemory-policy
 * would discard it under memory pressure, which arrives exactly during a large
 * outage when the alert queue is longest. The queues would be dropped at the
 * moment they matter most, and silently.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const compose = readFileSync(resolve(repo, 'docker-compose.yml'), 'utf8');

/** Directives only — the comments explain which policies are wrong and why. */
const composeDirectives = compose
  .split('\n')
  .map(line => line.replace(/#.*$/, ''))
  .join('\n');

/** Policies that discard keys to free memory. */
const EVICTING_POLICIES = [
  'allkeys-lru', 'allkeys-lfu', 'allkeys-random',
  'volatile-lru', 'volatile-lfu', 'volatile-random', 'volatile-ttl',
];

describe('redis queue durability', () => {
  test('a maxmemory-policy is set explicitly', () => {
    assert.match(composeDirectives, /--maxmemory-policy\s+\S+/, 'leaving it to the default is not a decision');
  });

  test('the policy does not evict', () => {
    const [, policy] = composeDirectives.match(/--maxmemory-policy\s+(\S+)/) || [];
    assert.equal(policy, 'noeviction', `queues must not be evictable, found ${policy}`);
  });

  test('no evicting policy is configured', () => {
    for (const policy of EVICTING_POLICIES) {
      assert.ok(!composeDirectives.includes(policy), `${policy} would discard queued work`);
    }
  });

  test('the comment explaining the choice survives', () => {
    // If someone removes the rationale, the next person will "tidy" this back.
    assert.match(compose, /allkeys-lru would evict/);
  });

  test('persistence is on, so a restart does not empty the queues', () => {
    assert.match(composeDirectives, /--appendonly\s+yes/);
  });
});

describe('queue writes are checked', () => {
  const read = p => readFileSync(resolve(repo, p), 'utf8');

  test('the ingest signals route inspects its pipeline result', () => {
    const src = read('services/ingest/src/routes/signals.js');
    assert.match(src, /pipelineOk/, 'an unchecked exec() treats a failed write as a success');
    assert.match(src, /503/, 'a failed queue write must not answer 202');
  });

  test('the worker re-queue path inspects its pipeline result', () => {
    const src = read('services/worker/src/lib/signal-drain.js');
    assert.match(src, /reResults/, 'the re-queue must confirm the signals made it back');
  });

  test('no queue pipeline is awaited without looking at the result', () => {
    const offenders = [];
    for (const file of [
      'services/ingest/src/routes/signals.js',
      'services/worker/src/lib/signal-drain.js',
    ]) {
      const src = read(file);
      // A bare `await <name>.exec();` discards the per-command errors.
      for (const m of src.matchAll(/^\s*await\s+\w+\.exec\(\)\s*;/gm)) {
        offenders.push(`${file}: ${m[0].trim()}`);
      }
    }
    assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n`);
  });
});
