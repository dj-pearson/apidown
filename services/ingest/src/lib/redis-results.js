/**
 * Reading the result of an ioredis pipeline.
 *
 * `pipeline.exec()` resolves to one `[error, result]` pair per queued command
 * and does not reject when an individual command fails. Awaiting it without
 * looking at the contents therefore treats every Redis failure as a success —
 * including `OOM command not allowed when used memory > maxmemory`, and the
 * `READONLY` a replica returns during a failover.
 *
 * That is how a queue write can be dropped while the endpoint answers 202: the
 * signals were never queued, the SDK was told they were, and nothing anywhere
 * records that they are gone.
 */

/** The errors from a pipeline result, ignoring the successful commands. */
export function pipelineErrors(results) {
  if (!Array.isArray(results)) return [];
  return results
    .map(entry => (Array.isArray(entry) ? entry[0] : null))
    .filter(Boolean);
}

/** True when every command in the pipeline succeeded. */
export function pipelineOk(results) {
  // A null result means the whole transaction was discarded.
  if (results === null || results === undefined) return false;
  return pipelineErrors(results).length === 0;
}

/** A single message summarising what failed, for logs. */
export function describePipelineFailure(results) {
  if (results === null || results === undefined) return 'pipeline returned no result';
  const errors = pipelineErrors(results);
  if (errors.length === 0) return null;
  const first = errors[0]?.message || String(errors[0]);
  return errors.length === 1 ? first : `${first} (and ${errors.length - 1} more)`;
}
