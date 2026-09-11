/**
 * Queue bookkeeping for alert delivery.
 *
 * The original drain read a batch with LRANGE and immediately deleted it with
 * LTRIM, before a single alert had been sent. Everything after that point was
 * unrecoverable: a crash, a redeploy, or an SMTP timeout part-way through
 * fifty jobs and those alerts were simply gone. For a product whose entire
 * promise is telling you an API is down, that is the failure that matters
 * most, and it happened silently.
 *
 * A job is now *claimed* onto a processing list rather than deleted, and only
 * removed once every subscriber has either been delivered to or recorded as
 * permanently undeliverable. Anything left on the processing list when a drain
 * starts belonged to a run that died, and is returned to the queue.
 *
 * This module holds the parts of that with no Redis in them, so they can be
 * tested directly.
 */

/** Total delivery attempts a job gets before it is dead-lettered. */
export const MAX_ATTEMPTS = 5;

/** Parse a queued job, tolerating anything malformed. */
export function parseJob(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const job = JSON.parse(raw);
    return job && typeof job === 'object' && !Array.isArray(job) ? job : null;
  } catch {
    return null;
  }
}

/** How many times this job has been attempted so far. */
export function attemptsOf(job) {
  const n = job?.attempts;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** The same job, marked as having been attempted once more. */
export function withAttempt(job) {
  return { ...job, attempts: attemptsOf(job) + 1 };
}

/**
 * Whether a job that just failed is worth putting back.
 *
 * `attemptsOf(job)` is how many attempts had already been made before this
 * one, so the run that just failed brings the total to `attemptsOf(job) + 1`.
 * Another is allowed only while that stays under the cap, which makes
 * MAX_ATTEMPTS the number of attempts actually made.
 */
export function shouldRetry(job, maxAttempts = MAX_ATTEMPTS) {
  return attemptsOf(job) + 1 < maxAttempts;
}

/**
 * Decide what to do with a job once its subscribers have been worked through.
 *
 * `results` is one entry per subscriber: 'sent', 'skipped' (deduplicated or
 * filtered out by a severity threshold) or 'failed'.
 *
 * Returns 'ack' when nothing is outstanding, 'retry' when something failed and
 * attempts remain, or 'dead-letter' when it has failed too many times.
 */
export function outcomeFor(job, results, maxAttempts = MAX_ATTEMPTS) {
  const failed = results.filter(r => r === 'failed').length;
  if (failed === 0) return 'ack';
  return shouldRetry(job, maxAttempts) ? 'retry' : 'dead-letter';
}

/**
 * Whether a subscriber should receive this alert, given their configured
 * minimum severity. Resolution notices always go out — someone told about an
 * outage needs to be told it ended, whatever their threshold.
 */
const SEVERITY_RANK = { minor: 1, major: 2, critical: 3 };

export function passesThreshold(subscription, { severity, eventType } = {}) {
  if (eventType === 'resolved') return true;

  const minimum = subscription?.threshold_config?.min_severity;
  if (!minimum) return true;

  const incidentRank = SEVERITY_RANK[severity];
  const minimumRank = SEVERITY_RANK[minimum];
  // An unrecognised severity on either side is not grounds for silence.
  if (!incidentRank || !minimumRank) return true;

  return incidentRank >= minimumRank;
}

export const ALERTS_QUEUE = 'alerts:pending';
/** Jobs claimed by a drain that has not finished with them yet. */
export const PROCESSING_QUEUE = 'alerts:processing';
/** Jobs that failed too many times, kept for inspection rather than dropped. */
export const DEAD_LETTER_QUEUE = 'alerts:dead';

/**
 * Anything still on the processing list when a drain begins was claimed by a
 * run that did not finish — a crash or a redeploy. Put it back at the front of
 * the queue. Re-delivery is safe: alert_log records what each subscriber has
 * already received, so a repeat attempt skips them.
 */
export async function reclaimAbandoned(redis, limit = 500) {
  let reclaimed = 0;
  while (reclaimed < limit) {
    const raw = await redis.lmove(PROCESSING_QUEUE, ALERTS_QUEUE, 'LEFT', 'LEFT');
    if (!raw) break;
    reclaimed++;
  }
  return reclaimed;
}

/**
 * Claim jobs one at a time, hand each to `processJob`, and only remove it once
 * its fate is settled. `processJob` returns the per-subscriber outcomes.
 *
 * This is the whole point of the module: nothing leaves the queue before it
 * has been delivered, so a crash mid-batch costs a retry rather than the
 * alerts themselves.
 */
export async function runDrain(redis, { processJob, batchSize = 50, log = console } = {}) {
  const stats = { claimed: 0, acked: 0, requeued: 0, deadLettered: 0, discarded: 0 };

  const reclaimed = await reclaimAbandoned(redis, batchSize * 10);
  if (reclaimed > 0) {
    log.warn?.(`[alerts] Reclaimed ${reclaimed} alert(s) abandoned by a previous run`);
  }

  // Jobs to put back are held until the pass ends. Requeueing inside the loop
  // would let this same drain claim them again immediately, burning every
  // attempt in one pass instead of giving a transient failure time to clear.
  const deferred = [];

  for (let handled = 0; handled < batchSize; handled++) {
    const raw = await redis.lmove(ALERTS_QUEUE, PROCESSING_QUEUE, 'LEFT', 'RIGHT');
    if (!raw) break;
    stats.claimed++;

    const job = parseJob(raw);
    if (!job) {
      log.error?.('[alerts] Discarding unparseable job');
      await redis.lrem(PROCESSING_QUEUE, 1, raw);
      stats.discarded++;
      continue;
    }

    let results;
    try {
      results = await processJob(job);
    } catch (err) {
      log.error?.(`[alerts] Job threw, will retry: ${err.message}`);
      results = ['failed'];
    }

    const outcome = outcomeFor(job, Array.isArray(results) ? results : []);
    if (outcome === 'ack') {
      await redis.lrem(PROCESSING_QUEUE, 1, raw);
      stats.acked++;
      continue;
    }

    const next = withAttempt(job);
    if (outcome === 'dead-letter') {
      log.error?.(
        `[alerts] Giving up on incident ${job.incident_id} after ${attemptsOf(next)} attempts`,
      );
      await redis.rpush(DEAD_LETTER_QUEUE, JSON.stringify(next));
      stats.deadLettered++;
    } else {
      log.warn?.(
        `[alerts] Requeueing incident ${job.incident_id}, attempt ${attemptsOf(next)} of ${MAX_ATTEMPTS}`,
      );
      deferred.push(JSON.stringify(next));
      stats.requeued++;
    }
    await redis.lrem(PROCESSING_QUEUE, 1, raw);
  }

  for (const raw of deferred) {
    await redis.rpush(ALERTS_QUEUE, raw);
  }

  return stats;
}
