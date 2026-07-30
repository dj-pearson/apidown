/**
 * Shared response helpers for the public read API under /v1.
 *
 * Every response uses the same envelope so clients (including the apidown CLI
 * and the MCP endpoint) can rely on one shape:
 *   success -> { data, meta: { generated_at, ... } }
 *   failure -> { error: { code, message } }
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function v1Json(data, { meta = {}, status = 200, maxAge = 60 } = {}) {
  return new Response(JSON.stringify({ data, meta: { generated_at: new Date().toISOString(), ...meta } }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      ...CORS_HEADERS,
    },
  });
}

export function v1Error(code, message, status = 400) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

/** Preflight/OPTIONS handler shared by every /v1 route. */
export function v1Options() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Clamp a `limit`/`offset` pair from search params. */
export function parsePaging(searchParams, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const rawLimit = Number(searchParams.get('limit'));
  const rawOffset = Number(searchParams.get('offset'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxLimit) : defaultLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

/** Public projection of an API row — never leak ids or owner columns. */
export function publicApi(api, extra = {}) {
  return {
    slug: api.slug,
    name: api.name,
    category: api.category,
    status: api.current_status || 'operational',
    ...extra,
  };
}

/** Public projection of an incident row. */
export function publicIncident(inc, apiSlug) {
  return {
    id: inc.id,
    api: apiSlug,
    severity: inc.severity,
    status: inc.status,
    title: inc.title,
    started_at: inc.started_at,
    resolved_at: inc.resolved_at || null,
    url: `https://apidown.net/incidents/${inc.id}`,
  };
}
