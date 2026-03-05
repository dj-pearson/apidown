import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { signalsRoute } from './routes/signals.js';
import { healthRoute } from './routes/health.js';
import { reportsRoute } from './routes/reports.js';
import { subscriptionsRoute } from './routes/subscriptions.js';
import { createRedisClient } from './lib/redis.js';
import { createSupabaseClient } from './lib/supabase.js';
import { buildDomainMap } from './lib/domain-map.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // CORS — SDK sends from various origins
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Global rate limit per IP
  await fastify.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  // Shared dependencies via decorators
  const redis = createRedisClient();
  const supabase = createSupabaseClient();

  fastify.decorate('redis', redis);
  fastify.decorate('supabase', supabase);

  // Build and cache domain→api_id map, refresh every 5 min
  const domainMap = await buildDomainMap(supabase);
  fastify.decorate('domainMap', domainMap);

  setInterval(async () => {
    try {
      const refreshed = await buildDomainMap(supabase);
      fastify.domainMap = refreshed;
      fastify.log.info(`Domain map refreshed: ${Object.keys(refreshed).length} domains`);
    } catch (err) {
      fastify.log.error('Failed to refresh domain map:', err.message);
    }
  }, 5 * 60 * 1000);

  // Routes
  await fastify.register(signalsRoute);
  await fastify.register(healthRoute);
  await fastify.register(reportsRoute);
  await fastify.register(subscriptionsRoute);

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('Shutting down...');
    await redis.quit();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Ingest service listening on ${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
