/**
 * API Key generation endpoint.
 * POST /v1/api-keys — creates a new API key for an authenticated user.
 */
export async function apiKeysRoute(fastify) {
  fastify.post('/v1/api-keys', async (request, reply) => {
    // Authenticate via Supabase JWT
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing authorization token' });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authErr } = await fastify.supabase.auth.getUser(token);

    if (authErr || !user) {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    // Check tier limits
    const { data: profile } = await fastify.supabase
      .from('users')
      .select('tier')
      .eq('id', user.id)
      .single();

    const tier = profile?.tier || 'free';
    const maxKeys = { free: 1, pro: 10, team: 50 }[tier] || 1;

    const { count } = await fastify.supabase
      .from('api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (count >= maxKeys) {
      return reply.code(403).send({
        error: `Key limit reached. ${tier} tier allows ${maxKeys} active key(s). Upgrade to create more.`,
      });
    }

    // Generate key: adn_live_<32 hex chars>
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const plainKey = `adn_live_${hex}`;

    // Hash for storage
    const keyHash = await hashKey(plainKey);
    const keyPrefix = plainKey.slice(0, 12); // adn_live_xxxx

    const label = request.body?.label || 'Default';

    const { error: insertErr } = await fastify.supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        label,
        is_active: true,
      });

    if (insertErr) {
      fastify.log.error('Failed to create API key:', insertErr.message);
      return reply.code(500).send({ error: 'Failed to create API key' });
    }

    // Return the plaintext key once — it's never stored
    return reply.code(201).send({ key: plainKey });
  });
}

async function hashKey(key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
