import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Some modules are deliberately duplicated because the frontend, ingest and
 * worker deploy separately and share no package. Duplication is fine; silent
 * drift is not — the two copies of the reliability score decide the grade a
 * user sees, and the two copies of the IP hash decide whether a rate limit
 * matches. Each pair is compared here, ignoring the header comment and
 * anything else the pair declares as allowed to differ.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Strip the leading comment block and normalise whitespace for comparison. */
function body(source) {
  return source
    .replace(/^(\s*\/\/[^\n]*\n)+/, '')       // leading // header lines
    .replace(/\r\n/g, '\n')
    .trim();
}

const PAIRS = [
  {
    name: 'ip-hash',
    a: 'frontend/src/lib/server/ip-hash.js',
    b: 'services/ingest/src/lib/ip-hash.js',
  },
  {
    name: 'safe-url',
    a: 'services/ingest/src/lib/safe-url.js',
    b: 'services/worker/src/lib/safe-url.js',
  },
];

describe('duplicated modules stay in step', () => {
  for (const pair of PAIRS) {
    test(`${pair.name}: both copies are identical`, () => {
      const a = body(readFileSync(resolve(repo, pair.a), 'utf8'));
      const b = body(readFileSync(resolve(repo, pair.b), 'utf8'));
      assert.equal(a, b, `${pair.a} and ${pair.b} have drifted apart`);
    });

    test(`${pair.name}: each copy points at the other`, () => {
      const a = readFileSync(resolve(repo, pair.a), 'utf8');
      const b = readFileSync(resolve(repo, pair.b), 'utf8');
      assert.ok(a.includes(pair.b), `${pair.a} should name its counterpart`);
      assert.ok(b.includes(pair.a), `${pair.b} should name its counterpart`);
    });
  }
});

describe('the reliability score agrees across services', () => {
  // Not byte-identical (the frontend copy also returns colours and a
  // breakdown), so compare behaviour instead.
  test('worker and frontend produce the same score and grade', async () => {
    const w = await import(resolve(repo, 'services/worker/src/lib/reliability-score.js'));
    const f = await import(resolve(repo, 'frontend/src/lib/reliability-score.js'));

    let checked = 0;
    for (const uptimePct of [100, 99.995, 99.95, 99.5, 99, 97, 95, 92, 90, 85, 0]) {
      for (const p95Ms of [0, 50, 150, 300, 800, 1500, 3000, 6000]) {
        for (const incidentCount of [0, 1, 2, 4, 7, 11, 50]) {
          for (const avgResolutionMin of [0, 10, 20, 45, 90, 300, 1000]) {
            const args = { uptimePct, p95Ms, incidentCount, avgResolutionMin };
            const a = w.computeReliabilityScore(args);
            const b = f.computeReliabilityScore(args);
            assert.equal(a.score, b.score, `score differs for ${JSON.stringify(args)}`);
            assert.equal(a.grade, b.grade, `grade differs for ${JSON.stringify(args)}`);
            checked++;
          }
        }
      }
    }
    assert.ok(checked > 4000, `expected a broad sweep, checked ${checked}`);
  });
});
