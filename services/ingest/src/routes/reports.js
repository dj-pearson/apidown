import { hashIp, resolveSalt, clientIpFrom } from '../lib/ip-hash.js';

const bodySchema = {
  type: 'object',
  required: ['api_slug'],
  properties: {
    api_slug: { type: 'string', minLength: 1, maxLength: 100 },
  },
};

export async function reportsRoute(fastify) {
  fastify.post('/v1/reports', {
    schema: { body: bodySchema },
    config: {
      rateLimit: { max: 5, timeWindow: '1 hour' },
    },
  }, async (request, reply) => {
    const { api_slug } = request.body;

    // Resolve slug → api_id
    const { data: api, error: apiErr } = await fastify.supabase
      .from('apis')
      .select('id')
      .eq('slug', api_slug)
      .single();

    if (apiErr || !api) {
      return reply.code(404).send({ error: 'Unknown API' });
    }

    // Pseudonymise the reporter IP: this value is written to a table that
    // would otherwise record who reported which outage.
    const ip = clientIpFrom(name => request.headers[name], request.ip);
    const { salt } = resolveSalt(process.env.IP_HASH_SALT, { warn: m => fastify.log.warn(m) });
    const reporterIp = await hashIp(ip, salt);

    // Check rate limit: max 3 reports per IP per API per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await fastify.supabase
      .from('manual_reports')
      .select('id', { count: 'exact', head: true })
      .eq('api_id', api.id)
      .eq('reporter_ip', reporterIp)
      .gte('created_at', oneHourAgo);

    if ((count || 0) >= 3) {
      return reply.code(429).send({ error: 'Report limit reached (3 per hour per API)' });
    }

    const { error: insertErr } = await fastify.supabase
      .from('manual_reports')
      .insert({ api_id: api.id, reporter_ip: reporterIp });

    if (insertErr) {
      fastify.log.error('Failed to insert manual report:', insertErr.message);
      return reply.code(500).send({ error: 'Failed to submit report' });
    }

    return reply.code(201).send({ submitted: true });
  });
}
