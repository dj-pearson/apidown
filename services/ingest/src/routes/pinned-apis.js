/**
 * Pinned APIs (My Stack) endpoints.
 * POST /v1/pinned-apis — pin an API
 * DELETE /v1/pinned-apis/:api_id — unpin an API
 * GET /v1/pinned-apis — list pinned APIs with status
 */
const PIN_LIMITS = { free: 3, pro: 20, team: Infinity };

export async function pinnedApisRoute(fastify) {
  // Auth helper
  async function authenticateUser(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Missing authorization token' });
      return null;
    }
    const token = authHeader.slice(7);
    const { data: { user }, error } = await fastify.supabase.auth.getUser(token);
    if (error || !user) {
      reply.code(401).send({ error: 'Invalid or expired token' });
      return null;
    }
    return user;
  }

  // GET — list user's pinned APIs with current status
  fastify.get('/v1/pinned-apis', async (request, reply) => {
    const user = await authenticateUser(request, reply);
    if (!user) return;

    const { data: pins } = await fastify.supabase
      .from('pinned_apis')
      .select('api_id, created_at, apis!inner(slug, name, current_status, logo_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    return reply.send({ pinned: pins || [] });
  });

  // POST — pin an API
  fastify.post('/v1/pinned-apis', async (request, reply) => {
    const user = await authenticateUser(request, reply);
    if (!user) return;

    const { api_id } = request.body || {};
    if (!api_id) {
      return reply.code(400).send({ error: 'api_id is required' });
    }

    // Check tier limits
    const { data: profile } = await fastify.supabase
      .from('users')
      .select('tier')
      .eq('id', user.id)
      .single();

    const tier = profile?.tier || 'free';
    const maxPinned = PIN_LIMITS[tier] || 3;

    const { count } = await fastify.supabase
      .from('pinned_apis')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (count >= maxPinned) {
      return reply.code(403).send({
        error: `Pin limit reached. ${tier} tier allows ${maxPinned === Infinity ? 'unlimited' : maxPinned} pinned APIs.`,
      });
    }

    const { error: insertErr } = await fastify.supabase
      .from('pinned_apis')
      .insert({ user_id: user.id, api_id });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return reply.code(409).send({ error: 'API already pinned' });
      }
      return reply.code(500).send({ error: 'Failed to pin API' });
    }

    return reply.code(201).send({ ok: true });
  });

  // DELETE — unpin an API
  fastify.delete('/v1/pinned-apis/:api_id', async (request, reply) => {
    const user = await authenticateUser(request, reply);
    if (!user) return;

    const { api_id } = request.params;

    await fastify.supabase
      .from('pinned_apis')
      .delete()
      .eq('user_id', user.id)
      .eq('api_id', api_id);

    return reply.send({ ok: true });
  });
}
