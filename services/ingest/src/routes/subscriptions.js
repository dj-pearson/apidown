const subscribeSchema = {
  type: 'object',
  required: ['api_slug', 'channel', 'destination'],
  properties: {
    api_slug: { type: 'string', minLength: 1, maxLength: 100 },
    channel: { type: 'string', enum: ['email', 'slack', 'pagerduty', 'discord', 'teams'] },
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

    // For slack/webhook channels: auto-verify (webhooks are self-verifying)
    // For email: require verification via token-based link
    const needsVerification = channel === 'email';

    const { data: sub, error: insertErr } = await fastify.supabase
      .from('alert_subscriptions')
      .insert({
        api_id: api.id,
        channel,
        destination,
        verified: !needsVerification,
        email_verified: !needsVerification,
        tier: 'free',
      })
      .select('token')
      .single();

    if (insertErr) {
      fastify.log.error('Failed to create subscription:', insertErr.message);
      return reply.code(500).send({ error: 'Failed to subscribe' });
    }

    if (needsVerification && sub?.token) {
      // In production, send verification email here
      fastify.log.info(`Verification link for ${destination}: /v1/verify?token=${sub.token}`);
    }

    return reply.code(201).send({
      subscribed: true,
      needs_verification: needsVerification,
    });
  });

  // Verify email subscription
  fastify.get('/v1/verify', async (request, reply) => {
    const token = request.query.token;
    if (!token || token.length < 10) {
      return reply.code(400).send({ error: 'Invalid token' });
    }

    const { data, error } = await fastify.supabase
      .from('alert_subscriptions')
      .update({ verified: true, email_verified: true })
      .eq('token', token)
      .eq('verified', false)
      .select('id, destination');

    if (error) {
      return reply.code(500).send({ error: 'Verification failed' });
    }

    if (!data || data.length === 0) {
      return reply.code(404).send({ error: 'Subscription not found or already verified' });
    }

    return reply.code(200).send({ verified: true, destination: data[0].destination });
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
