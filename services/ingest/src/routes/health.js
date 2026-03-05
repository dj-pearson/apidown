export async function healthRoute(fastify) {
  fastify.get('/health', async (request, reply) => {
    try {
      await fastify.redis.ping();
      return reply.send({
        status: 'ok',
        service: 'apidown-ingest',
        timestamp: new Date().toISOString(),
        domainCount: Object.keys(fastify.domainMap).filter(k => k !== '__wildcards').length,
      });
    } catch {
      return reply.code(503).send({
        status: 'unhealthy',
        service: 'apidown-ingest',
      });
    }
  });
}
