import { CORS_HEADERS } from '$lib/server/v1.js';

const SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'APIdown Public API',
    version: '1.0.0',
    description:
      'Read-only access to APIdown status data. No API key required. Figures are derived from crowd-sourced client-side signals and are not vendor-reported measurements.',
    contact: { name: 'APIdown', url: 'https://apidown.net/docs' },
    license: { name: 'Data available under attribution — see https://apidown.net/data' },
  },
  servers: [{ url: 'https://apidown.net', description: 'Production' }],
  tags: [
    { name: 'apis', description: 'Tracked third-party APIs and their live status' },
    { name: 'incidents', description: 'Detected outages and degradations' },
  ],
  paths: {
    '/v1/apis': {
      get: {
        tags: ['apis'],
        summary: 'List tracked APIs',
        operationId: 'listApis',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category slug, e.g. ai or payments' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['operational', 'degraded', 'down'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 200 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: 'A page of tracked APIs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/ApiSummary' } },
                    meta: { $ref: '#/components/schemas/PageMeta' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/v1/apis/{slug}': {
      get: {
        tags: ['apis'],
        summary: 'Get one API status',
        operationId: 'getApi',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Current status with 24h and 30d windows',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/ApiDetail' }, meta: { type: 'object' } },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/v1/apis/{slug}/history': {
      get: {
        tags: ['apis'],
        summary: 'Monthly uptime and incident history',
        operationId: 'getApiHistory',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'months', in: 'query', schema: { type: 'integer', default: 12, maximum: 24 } },
        ],
        responses: {
          200: {
            description: 'Month-by-month rollup, newest first',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        api: { $ref: '#/components/schemas/ApiSummary' },
                        months: { type: 'array', items: { $ref: '#/components/schemas/MonthStats' } },
                      },
                    },
                    meta: { type: 'object' },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/v1/incidents': {
      get: {
        tags: ['incidents'],
        summary: 'List incidents',
        operationId: 'listIncidents',
        parameters: [
          { name: 'api', in: 'query', schema: { type: 'string' }, description: 'Restrict to one API slug' },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['critical', 'major', 'minor'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['investigating', 'identified', 'monitoring', 'resolved'] } },
          { name: 'open', in: 'query', schema: { type: 'boolean' }, description: 'Only unresolved incidents' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: 'A page of incidents, newest first',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Incident' } },
                    meta: { $ref: '#/components/schemas/PageMeta' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/Error' },
        },
      },
    },
  },
  components: {
    responses: {
      Error: {
        description: 'Request failed',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: {
                  type: 'object',
                  properties: { code: { type: 'string' }, message: { type: 'string' } },
                  required: ['code', 'message'],
                },
              },
            },
          },
        },
      },
    },
    schemas: {
      PageMeta: {
        type: 'object',
        properties: {
          generated_at: { type: 'string', format: 'date-time' },
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
        },
      },
      ApiSummary: {
        type: 'object',
        properties: {
          slug: { type: 'string', examples: ['stripe'] },
          name: { type: 'string', examples: ['Stripe'] },
          category: { type: 'string', examples: ['payments'] },
          status: { type: 'string', enum: ['operational', 'degraded', 'down'] },
          p50_ms: { type: ['integer', 'null'] },
          p95_ms: { type: ['integer', 'null'] },
          open_incidents: { type: 'integer' },
          url: { type: 'string', format: 'uri' },
        },
      },
      ApiDetail: {
        allOf: [
          { $ref: '#/components/schemas/ApiSummary' },
          {
            type: 'object',
            properties: {
              window_24h: {
                type: 'object',
                properties: {
                  signals: { type: 'integer' },
                  p50_ms: { type: ['integer', 'null'] },
                  p95_ms: { type: ['integer', 'null'] },
                  error_rate: { type: ['number', 'null'] },
                  uptime_pct: { type: ['number', 'null'] },
                },
              },
              window_30d: {
                type: 'object',
                properties: {
                  incident_count: { type: 'integer' },
                  uptime_pct: { type: ['number', 'null'] },
                },
              },
              open_incidents: { type: 'array', items: { $ref: '#/components/schemas/Incident' } },
            },
          },
        ],
      },
      MonthStats: {
        type: 'object',
        properties: {
          month: { type: 'string', examples: ['2026-07'] },
          uptime_pct: { type: ['number', 'null'] },
          incident_count: { type: 'integer' },
          downtime_minutes: { type: 'integer' },
          longest_outage_minutes: { type: 'integer' },
          url: { type: 'string', format: 'uri' },
          incidents: { type: 'array', items: { $ref: '#/components/schemas/Incident' } },
        },
      },
      Incident: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          api: { type: 'string', examples: ['stripe'] },
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          status: { type: 'string', enum: ['investigating', 'identified', 'monitoring', 'resolved'] },
          title: { type: 'string' },
          started_at: { type: 'string', format: 'date-time' },
          resolved_at: { type: ['string', 'null'], format: 'date-time' },
          url: { type: 'string', format: 'uri' },
        },
      },
    },
  },
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function GET() {
  return new Response(JSON.stringify(SPEC, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      ...CORS_HEADERS,
    },
  });
}
