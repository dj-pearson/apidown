import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJob,
  attemptsOf,
  withAttempt,
  shouldRetry,
  outcomeFor,
  passesThreshold,
  MAX_ATTEMPTS,
} from '../src/lib/alert-queue.js';

describe('parseJob', () => {
  test('parses a queued job', () => {
    assert.deepEqual(parseJob('{"incident_id":"i1"}'), { incident_id: 'i1' });
  });

  test('returns null for anything unusable rather than throwing', () => {
    for (const raw of ['not json', '', '[]', 'null', '42', '"str"', undefined, null, 123]) {
      assert.equal(parseJob(raw), null, String(raw));
    }
  });
});

describe('attempt counting', () => {
  test('a fresh job has no attempts', () => {
    assert.equal(attemptsOf({}), 0);
    assert.equal(attemptsOf(null), 0);
  });

  test('ignores a nonsense attempt count', () => {
    for (const n of [-1, NaN, Infinity, 'three', null]) {
      assert.equal(attemptsOf({ attempts: n }), 0, String(n));
    }
  });

  test('withAttempt increments without mutating the original', () => {
    const job = { incident_id: 'i1' };
    const next = withAttempt(job);
    assert.equal(next.attempts, 1);
    assert.equal(job.attempts, undefined);
    assert.equal(next.incident_id, 'i1');
  });

  test('increments repeatedly', () => {
    let job = {};
    for (let i = 1; i <= 3; i++) {
      job = withAttempt(job);
      assert.equal(job.attempts, i);
    }
  });
});

describe('shouldRetry', () => {
  test('retries while attempts remain', () => {
    assert.equal(shouldRetry({ attempts: 0 }), true);
    assert.equal(shouldRetry({ attempts: MAX_ATTEMPTS - 2 }), true);
  });

  test('stops once the cap has been reached', () => {
    // attempts is the count BEFORE the run that just failed, so at
    // MAX_ATTEMPTS - 1 the job has now been tried MAX_ATTEMPTS times.
    assert.equal(shouldRetry({ attempts: MAX_ATTEMPTS - 1 }), false);
    assert.equal(shouldRetry({ attempts: MAX_ATTEMPTS }), false);
    assert.equal(shouldRetry({ attempts: MAX_ATTEMPTS + 10 }), false);
  });

  test('a cap of one means a single attempt and no retry', () => {
    assert.equal(shouldRetry({ attempts: 0 }, 1), false);
  });

  test('a cap of two allows exactly one retry', () => {
    assert.equal(shouldRetry({ attempts: 0 }, 2), true);
    assert.equal(shouldRetry({ attempts: 1 }, 2), false);
  });
});

describe('outcomeFor', () => {
  test('acknowledges when every subscriber was handled', () => {
    assert.equal(outcomeFor({}, ['sent', 'sent']), 'ack');
    assert.equal(outcomeFor({}, ['sent', 'skipped']), 'ack');
    assert.equal(outcomeFor({}, []), 'ack');
    assert.equal(outcomeFor({}, ['skipped']), 'ack');
  });

  test('retries when a send failed and attempts remain', () => {
    assert.equal(outcomeFor({ attempts: 0 }, ['sent', 'failed']), 'retry');
  });

  test('one failure among many still retries the job', () => {
    assert.equal(outcomeFor({ attempts: 1 }, ['sent', 'sent', 'sent', 'failed']), 'retry');
  });

  test('dead-letters once the cap is reached', () => {
    assert.equal(outcomeFor({ attempts: MAX_ATTEMPTS - 1 }, ['failed']), 'dead-letter');
    assert.equal(outcomeFor({ attempts: MAX_ATTEMPTS }, ['failed']), 'dead-letter');
  });

  test('a job that fails every time eventually stops', () => {
    let job = {};
    const seen = [];
    for (let i = 0; i < MAX_ATTEMPTS + 2; i++) {
      job = withAttempt(job);
      seen.push(outcomeFor(job, ['failed']));
    }
    assert.ok(seen.includes('dead-letter'), 'must give up eventually');
    assert.equal(seen[seen.length - 1], 'dead-letter');
  });
});

describe('passesThreshold', () => {
  const sub = min => ({ threshold_config: min ? { min_severity: min } : null });

  test('a subscriber with no threshold gets everything', () => {
    assert.equal(passesThreshold(sub(null), { severity: 'minor', eventType: 'incident' }), true);
    assert.equal(passesThreshold({}, { severity: 'minor' }), true);
    assert.equal(passesThreshold(null, { severity: 'minor' }), true);
  });

  test('filters incidents below the configured minimum', () => {
    assert.equal(passesThreshold(sub('major'), { severity: 'minor', eventType: 'incident' }), false);
    assert.equal(passesThreshold(sub('critical'), { severity: 'major', eventType: 'incident' }), false);
  });

  test('passes incidents at or above the minimum', () => {
    assert.equal(passesThreshold(sub('major'), { severity: 'major', eventType: 'incident' }), true);
    assert.equal(passesThreshold(sub('major'), { severity: 'critical', eventType: 'incident' }), true);
  });

  test('resolution notices always go out', () => {
    // Someone told about an outage must be told it ended.
    assert.equal(passesThreshold(sub('critical'), { severity: 'minor', eventType: 'resolved' }), true);
    assert.equal(passesThreshold(sub('critical'), { severity: 'resolved', eventType: 'resolved' }), true);
  });

  test('an unrecognised severity is not grounds for silence', () => {
    assert.equal(passesThreshold(sub('major'), { severity: 'unknown', eventType: 'incident' }), true);
    assert.equal(passesThreshold(sub('nonsense'), { severity: 'minor', eventType: 'incident' }), true);
    assert.equal(passesThreshold(sub('major'), { severity: undefined, eventType: 'incident' }), true);
  });
});
