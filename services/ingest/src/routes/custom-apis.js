/**
 * Custom APIs endpoints.
 * POST /v1/custom-apis — create a custom API to monitor
 * DELETE /v1/custom-apis/:id — remove a custom API
 */
import { encryptProbeAuth, maskAuthValue } from '../lib/probe-crypto.js';

const CUSTOM_API_LIMITS = { free: 1, pro: 5, team: Infinity };

export async function customApisRoute(fastify) {
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

  // POST — create a custom API
  fastify.post('/v1/custom-apis', async (request, reply) => {
    const user = await authenticateUser(request, reply);
    if (!user) return;

    const { name, url, expected_status, auth_header_name, auth_header_value } = request.body || {};

    if (!name || !url) {
      return reply.code(400).send({ error: 'name and url are required' });
    }

    // Validate URL and extract domain
    let parsed;
    try {
      parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('invalid protocol');
      }
    } catch {
      return reply.code(400).send({ error: 'Invalid URL. Must be a valid http/https URL.' });
    }

    const domain = parsed.hostname;
    const status = expected_status && Number.isInteger(expected_status) ? expected_status : 200;

    // Generate slug from name
    const slug = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${user.id.slice(0, 8)}`;

    // Check tier limits
    const { data: profile } = await fastify.supabase
      .from('users')
      .select('tier')
      .eq('id', user.id)
      .single();

    const tier = profile?.tier || 'free';
    const maxCustom = CUSTOM_API_LIMITS[tier] || 1;

    const { count } = await fastify.supabase
      .from('apis')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('is_custom', true);

    if (maxCustom !== Infinity && count >= maxCustom) {
      return reply.code(403).send({
        error: `Custom API limit reached. ${tier} tier allows ${maxCustom} custom API${maxCustom > 1 ? 's' : ''}.`,
        limit: maxCustom,
        current: count,
      });
    }

    // Encrypt auth header if provided
    let probe_auth_encrypted = null;
    let probe_auth_hint = null;

    if (auth_header_name && auth_header_value) {
      const headerName = auth_header_name.trim();
      const headerVal = auth_header_value.trim();
      // Store as "HeaderName: value" so the prober can split on first ": "
      const fullHeader = `${headerName}: ${headerVal}`;
      try {
        probe_auth_encrypted = encryptProbeAuth(fullHeader);
      } catch (err) {
        fastify.log.error('Encryption failed:', err.message);
        return reply.code(500).send({ error: 'Server encryption configuration error. Contact support.' });
      }
      probe_auth_hint = `${headerName}: ${maskAuthValue(headerVal)}`;
    }

    // Insert the custom API
    const { data: api, error: insertErr } = await fastify.supabase
      .from('apis')
      .insert({
        name,
        slug,
        category: 'custom',
        base_domains: [domain],
        probe_url: url,
        expected_status: status,
        owner_id: user.id,
        is_custom: true,
        current_status: 'operational',
        probe_auth_encrypted,
        probe_auth_hint,
      })
      .select('id, slug, name, base_domains, probe_url, expected_status, current_status, probe_auth_hint, created_at')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return reply.code(409).send({ error: 'An API with this name already exists.' });
      }
      return reply.code(500).send({ error: 'Failed to create custom API' });
    }

    // Auto-pin the API for the user
    await fastify.supabase
      .from('pinned_apis')
      .insert({ user_id: user.id, api_id: api.id })
      .catch(() => {}); // Ignore if already pinned

    return reply.code(201).send(api);
  });

  // DELETE — remove a custom API
  fastify.delete('/v1/custom-apis/:id', async (request, reply) => {
    const user = await authenticateUser(request, reply);
    if (!user) return;

    const { id } = request.params;

    // Verify ownership
    const { data: api } = await fastify.supabase
      .from('apis')
      .select('id, owner_id')
      .eq('id', id)
      .eq('owner_id', user.id)
      .eq('is_custom', true)
      .single();

    if (!api) {
      return reply.code(404).send({ error: 'Custom API not found or not owned by you' });
    }

    // Remove pinned_apis entries first, then the API
    await fastify.supabase.from('pinned_apis').delete().eq('api_id', id);
    await fastify.supabase.from('alert_subscriptions').delete().eq('api_id', id);
    const { error: delErr } = await fastify.supabase.from('apis').delete().eq('id', id);

    if (delErr) {
      return reply.code(500).send({ error: 'Failed to delete custom API' });
    }

    return reply.send({ ok: true });
  });
}
