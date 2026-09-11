import { resolveDomain } from '../lib/domain-map.js';
import { normalizeTimestamp } from '../lib/signal-time.js';
import { pipelineOk, describePipelineFailure } from '../lib/redis-results.js';

const SIGNALS_QUEUE = 'signals:raw';

// Fastify JSON schema for request validation
const signalSchema = {
  type: 'object',
  required: ['domain', 'status', 'duration', 'ts'],
  properties: {
    domain: { type: 'string', minLength: 3, maxLength: 253 },
    status: { type: 'integer', minimum: 0, maximum: 599 },
    duration: { type: 'integer', minimum: 0, maximum: 300000 },
    ts: { type: 'integer' },
  },
};

const bodySchema = {
  type: 'object',
  required: ['signals'],
  properties: {
    signals: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      items: signalSchema,
    },
  },
};

export async function signalsRoute(fastify) {
  fastify.post('/v1/signals', {
    schema: {
      body: bodySchema,
    },
  }, async (request, reply) => {
    // Validate API key
    const apiKey = request.headers['x-apidown-key'] || request.body.api_key;
    if (!apiKey || apiKey.length < 8) {
      return reply.code(401).send({ error: 'Invalid or missing API key' });
    }

    // Verify key against database
    const keyHash = await hashKey(apiKey);
    const { data: keyRecord } = await fastify.supabase
      .from('api_keys')
      .select('id, user_id, is_active')
      .eq('key_hash', keyHash)
      .single();

    if (!keyRecord || !keyRecord.is_active) {
      return reply.code(401).send({ error: 'Invalid or revoked API key' });
    }

    // Update last_used_at (fire and forget)
    fastify.supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)
      .then(() => {});

    const { signals } = request.body;

    // Detect region from CF headers or fallback
    const region = request.headers['cf-ipcountry']
      || request.headers['x-region']
      || 'unknown';

    const reporterHash = keyHash.slice(0, 16);

    let queued = 0;
    const skipped = { unknown_domain: 0, bad_timestamp: 0 };
    let sawSecondsTimestamp = false;
    const pipeline = fastify.redis.pipeline();
    const now = Date.now();

    for (const signal of signals) {
      const apiId = resolveDomain(fastify.domainMap, signal.domain);
      if (!apiId) {
        skipped.unknown_domain++;
        continue;
      }

      // Never let one malformed timestamp throw and take the batch with it.
      const when = normalizeTimestamp(signal.ts, now);
      if (!when.ok) {
        skipped.bad_timestamp++;
        continue;
      }
      if (when.unit === 'seconds') sawSecondsTimestamp = true;

      pipeline.rpush(SIGNALS_QUEUE, JSON.stringify({
        api_id: apiId,
        region,
        status_code: signal.status,
        duration_ms: signal.duration,
        time: when.iso,
        reporter_hash: reporterHash,
      }));
      queued++;
    }

    if (queued > 0) {
      // exec() reports per-command errors in its result rather than throwing,
      // so an unchecked await treats a full or read-only Redis as a success
      // and answers 202 for signals that were never queued.
      const execResults = await pipeline.exec();
      if (!pipelineOk(execResults)) {
        const detail = describePipelineFailure(execResults);
        fastify.log.error({ detail, queued }, 'Failed to queue signals');
        return reply.code(503).send({
          error: 'Signal queue unavailable, nothing was recorded. Please retry.',
          queued: 0,
        });
      }
    }

    if (sawSecondsTimestamp) {
      fastify.log.warn(
        { key_prefix: reporterHash.slice(0, 8) },
        'Signals arrived with epoch-seconds timestamps and were promoted to milliseconds; the SDK should send milliseconds.',
      );
    }

    // Report what was dropped. Returning a bare 202 for a batch that was
    // entirely discarded is how an integration looks healthy while sending
    // nothing usable.
    const rejected = skipped.unknown_domain + skipped.bad_timestamp;
    return reply.code(202).send(rejected > 0 ? { queued, rejected, skipped } : { queued });
  });
}

async function hashKey(key) {
  // Use Web Crypto API (available in Node 20+)
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
