const subscribeSchema = {
  type: 'object',
  required: ['api_slug', 'channel', 'destination'],
  properties: {
    api_slug: { type: 'string', minLength: 1, maxLength: 100 },
    channel: { type: 'string', enum: ['email', 'slack'] },
    destination: { type: 'string', minLength: 3, maxLength: 500 },
  },
};

export async function subscriptionsRoute(fastify) {
  // Subscribe to alerts for an API
  fastify.post('/v1/subscribe', {
    schema: { body: subscribeSchema },
    config: {
      rateLimit: { max: 10, timeWindow: '1 hour' },
    },
  }, async (request, reply) => {
    const { api_slug, channel, destination } = request.body;

    // Basic email validation for email channel
    if (channel === 'email' && !destination.includes('@')) {
      return reply.code(400).send({ error: 'Invalid email address' });
    }

    // Basic URL validation for slack channel
    if (channel === 'slack' && !destination.startsWith('https://hooks.slack.com/')) {
      return reply.code(400).send({ error: 'Invalid Slack webhook URL' });
    }

    // Resolve slug → api_id
    const { data: api, error: apiErr } = await fastify.supabase
      .from('apis')
      .select('id')
      .eq('slug', api_slug)
      .single();

    if (apiErr || !api) {
      return reply.code(404).send({ error: 'Unknown API' });
    }

    // Check for existing subscription (prevent duplicates)
    const { data: existing } = await fastify.supabase
      .from('alert_subscriptions')
      .select('id')
      .eq('api_id', api.id)
      .eq('channel', channel)
      .eq('destination', destination)
      .limit(1);

    if (existing && existing.length > 0) {
      return reply.code(200).send({ status: 'already_subscribed' });
    }

    // For email: mark as verified=true for now (v1.1 will add email verification)
    // For slack: webhooks are self-verifying
    const { error: insertErr } = await fastify.supabase
      .from('alert_subscriptions')
      .insert({
        api_id: api.id,
        channel,
        destination,
        verified: true,
        tier: 'free',
      });

    if (insertErr) {
      fastify.log.error('Failed to create subscription:', insertErr.message);
      return reply.code(500).send({ error: 'Failed to subscribe' });
    }

    return reply.code(201).send({ subscribed: true });
  });

  // Unsubscribe via token
  fastify.get('/v1/unsubscribe', async (request, reply) => {
    const token = request.query.token;
    if (!token || token.length < 10) {
      return reply.code(400).send({ error: 'Invalid token' });
    }

    const { data, error } = await fastify.supabase
      .from('alert_subscriptions')
      .delete()
      .eq('token', token)
      .select('id');

    if (error) {
      return reply.code(500).send({ error: 'Failed to unsubscribe' });
    }

    if (!data || data.length === 0) {
      return reply.code(404).send({ error: 'Subscription not found' });
    }

    return reply.code(200).send({ unsubscribed: true });
  });
}
