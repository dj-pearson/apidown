import { resolveDomain } from '../lib/domain-map.js';

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
    const apiKey = request.headers['x-apidown-key'];
    if (!apiKey || apiKey.length < 8) {
      return reply.code(401).send({ error: 'Invalid or missing API key' });
    }

    const { signals } = request.body;

    // Detect region from CF headers or fallback
    const region = request.headers['cf-ipcountry']
      || request.headers['x-region']
      || 'unknown';

    // Hash the reporter key for anonymization (SHA-256 not reversible to key)
    const reporterHash = await hashKey(apiKey);

    let queued = 0;
    const pipeline = fastify.redis.pipeline();

    for (const signal of signals) {
      const apiId = resolveDomain(fastify.domainMap, signal.domain);
      if (!apiId) continue; // Unknown domain — skip

      const enriched = {
        api_id: apiId,
        region,
        status_code: signal.status,
        duration_ms: signal.duration,
        time: new Date(signal.ts).toISOString(),
        reporter_hash: reporterHash,
      };

      pipeline.rpush(SIGNALS_QUEUE, JSON.stringify(enriched));
      queued++;
    }

    if (queued > 0) {
      await pipeline.exec();
    }

    return reply.code(202).send({ queued });
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
