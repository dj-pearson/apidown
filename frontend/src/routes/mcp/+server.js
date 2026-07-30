import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { publicApi, publicIncident, CORS_HEADERS } from '$lib/server/v1.js';
import { monthlyBreakdown, uptimePctInWindow } from '$lib/api-history.js';
import { categoryList } from '$lib/categories.js';

/**
 * Model Context Protocol endpoint (Streamable HTTP transport).
 *
 * Read-only: an agent can ask what is down, look up one API, list incidents,
 * and pull uptime history. There are no write tools and nothing authenticated
 * is reachable from here.
 */

const PROTOCOL_VERSION = '2025-06-18';

const SERVER_INFO = {
  name: 'apidown',
  title: 'APIdown — real API status from real traffic',
  version: '1.0.0',
};

const CATEGORY_SLUGS = categoryList().map(c => c.slug);

const TOOLS = [
  {
    name: 'list_apis',
    title: 'List tracked APIs and their live status',
    description:
      'Lists the third-party APIs APIdown monitors, with each one\'s current status (operational, degraded, or down). Use this to find the right slug before calling another tool, or to answer "what is down right now" by filtering on status=down.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['operational', 'degraded', 'down'],
          description: 'Only return APIs currently in this state.',
        },
        category: {
          type: 'string',
          enum: CATEGORY_SLUGS,
          description: 'Only return APIs in this category.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_api_status',
    title: 'Get one API\'s current status and recent metrics',
    description:
      'Returns the current status of one API plus measured p50/p95 latency and error rate over the last 24 hours, 30-day uptime, and any open incidents. Use this when a user asks whether a specific API is down or slow, for example before concluding that their own code is at fault.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'API slug, e.g. "stripe" or "openai". Call list_apis if unsure.',
        },
      },
      required: ['slug'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_incidents',
    title: 'List detected incidents',
    description:
      'Lists outages and degradations detected across tracked APIs, newest first. Filter by API slug, severity, or open-only. Use this to check whether a recent failure lines up with a known incident.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Restrict to one API slug.' },
        severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
        open_only: { type: 'boolean', description: 'Only incidents that are not yet resolved.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 20.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_api_history',
    title: 'Get monthly uptime history for one API',
    description:
      'Returns month-by-month measured uptime, incident count, and total downtime for one API. Use this for reliability comparisons over time or vendor due diligence.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'API slug, e.g. "aws-s3".' },
        months: { type: 'integer', minimum: 1, maximum: 24, description: 'How many months back. Default 6.' },
      },
      required: ['slug'],
      additionalProperties: false,
    },
  },
];

const MEASUREMENT_NOTE =
  'Measured from anonymised client-side signals, not the vendor\'s own reporting.';

function jsonRpcResult(id, result) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function jsonRpcError(id, code, message, status = 200) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

/** MCP tool results carry text content plus a structured payload. */
function toolResult(id, payload) {
  return jsonRpcResult(id, {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  });
}

function toolError(id, message) {
  return jsonRpcResult(id, {
    isError: true,
    content: [{ type: 'text', text: message }],
  });
}

async function findApi(supabase, slug) {
  const { data } = await supabase
    .from('apis')
    .select('id, slug, name, category, current_status')
    .eq('slug', slug)
    .is('owner_id', null)
    .maybeSingle();
  return data;
}

async function runTool(name, args, supabase) {
  const now = Date.now();

  if (name === 'list_apis') {
    let query = supabase
      .from('apis')
      .select('id, slug, name, category, current_status')
      .is('owner_id', null)
      .order('name');
    if (args.status) query = query.eq('current_status', args.status);
    if (args.category) query = query.eq('category', args.category);

    const { data } = await query;
    const rows = data || [];
    return {
      count: rows.length,
      note: MEASUREMENT_NOTE,
      apis: rows.map(a => publicApi(a, { url: `https://apidown.net/api/${a.slug}` })),
    };
  }

  if (name === 'get_api_status') {
    if (!args.slug) return { error: 'slug is required' };
    const api = await findApi(supabase, args.slug);
    if (!api) return { error: `No tracked API with slug "${args.slug}". Call list_apis for valid slugs.` };

    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: latency }, { data: incidents }] = await Promise.all([
      supabase
        .from('signals_1min')
        .select('p50_ms, p95_ms, total_signals, error_count')
        .eq('api_id', api.id)
        .gte('bucket', dayAgo),
      supabase
        .from('incidents')
        .select('id, severity, status, title, started_at, resolved_at')
        .eq('api_id', api.id)
        .gte('started_at', thirtyDaysAgo)
        .order('started_at', { ascending: false }),
    ]);

    let signals = 0, p50 = 0, p95 = 0, errors = 0;
    for (const row of latency || []) {
      const n = row.total_signals || 0;
      signals += n;
      p50 += (row.p50_ms || 0) * n;
      p95 += (row.p95_ms || 0) * n;
      errors += row.error_count || 0;
    }

    const all = incidents || [];
    const open = all.filter(i => i.status !== 'resolved');

    return {
      slug: api.slug,
      name: api.name,
      category: api.category,
      status: api.current_status,
      note: MEASUREMENT_NOTE,
      last_24h: {
        signals,
        p50_ms: signals ? Math.round(p50 / signals) : null,
        p95_ms: signals ? Math.round(p95 / signals) : null,
        error_rate: signals ? Math.round((errors / signals) * 10000) / 10000 : null,
      },
      last_30d: {
        uptime_pct: uptimePctInWindow(all, now - 30 * 24 * 60 * 60 * 1000, now, now),
        incident_count: all.length,
      },
      open_incidents: open.map(i => publicIncident(i, api.slug)),
      url: `https://apidown.net/api/${api.slug}`,
    };
  }

  if (name === 'list_incidents') {
    const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);

    const { data: apis } = await supabase.from('apis').select('id, slug').is('owner_id', null);
    const apiList = apis || [];
    const slugById = {};
    for (const a of apiList) slugById[a.id] = a.slug;

    let apiIds = apiList.map(a => a.id);
    if (args.slug) {
      const match = apiList.find(a => a.slug === args.slug);
      if (!match) return { error: `No tracked API with slug "${args.slug}".` };
      apiIds = [match.id];
    }
    if (apiIds.length === 0) return { count: 0, incidents: [] };

    let query = supabase
      .from('incidents')
      .select('id, api_id, severity, status, title, started_at, resolved_at')
      .in('api_id', apiIds)
      .order('started_at', { ascending: false })
      .limit(limit);
    if (args.severity) query = query.eq('severity', args.severity);
    if (args.open_only) query = query.neq('status', 'resolved');

    const { data } = await query;
    const rows = data || [];
    return {
      count: rows.length,
      note: MEASUREMENT_NOTE,
      incidents: rows.map(i => publicIncident(i, slugById[i.api_id])),
    };
  }

  if (name === 'get_api_history') {
    if (!args.slug) return { error: 'slug is required' };
    const api = await findApi(supabase, args.slug);
    if (!api) return { error: `No tracked API with slug "${args.slug}".` };

    const months = Math.min(Math.max(Number(args.months) || 6, 1), 24);
    const d = new Date();
    const oldest = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (months - 1), 1)).toISOString();

    const { data: incidents } = await supabase
      .from('incidents')
      .select('started_at, resolved_at')
      .eq('api_id', api.id)
      .gte('started_at', oldest);

    return {
      slug: api.slug,
      name: api.name,
      note: MEASUREMENT_NOTE,
      months: monthlyBreakdown(incidents || [], months).map(m => ({
        month: m.month,
        uptime_pct: m.uptimePct,
        incident_count: m.incidentCount,
        downtime_minutes: Math.round(m.downtimeMs / 60000),
      })),
    };
  }

  return { error: `Unknown tool "${name}"` };
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
  });
}

/** GET advertises the endpoint; this transport does not open an SSE stream. */
export function GET() {
  return new Response(
    JSON.stringify({
      name: SERVER_INFO.name,
      description: 'Read-only MCP server for APIdown API status data. POST JSON-RPC 2.0 to this URL.',
      protocolVersion: PROTOCOL_VERSION,
      tools: TOOLS.map(t => t.name),
      documentation: 'https://apidown.net/docs#mcp',
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS } },
  );
}

export async function POST({ request, platform }) {
  setPlatform(platform);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, 'Parse error: body must be JSON', 400);
  }

  // Batches are not supported; reject clearly rather than half-handling them.
  if (Array.isArray(body)) {
    return jsonRpcError(null, -32600, 'Batch requests are not supported', 400);
  }

  const { id, method, params } = body || {};

  if (typeof method !== 'string') {
    return jsonRpcError(id, -32600, 'Invalid Request: "method" is required', 400);
  }

  // Notifications carry no id and expect no response body.
  if (method.startsWith('notifications/')) {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  if (method === 'initialize') {
    return jsonRpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions:
        'APIdown reports whether third-party APIs are actually down, measured from real client-side traffic rather than vendor status pages. When a user hits errors calling a third-party API, use get_api_status to check it before assuming their own code is at fault.',
    });
  }

  if (method === 'ping') {
    return jsonRpcResult(id, {});
  }

  if (method === 'tools/list') {
    return jsonRpcResult(id, { tools: TOOLS });
  }

  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments || {};
    if (!TOOLS.some(t => t.name === name)) {
      return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
    }
    try {
      const payload = await runTool(name, args, getSupabaseAdmin());
      // A tool-level problem is reported as an error result, not a protocol error.
      if (payload?.error) return toolError(id, payload.error);
      return toolResult(id, payload);
    } catch (err) {
      console.error(`[APIdown] MCP tool ${name} failed:`, err?.message || err);
      return toolError(id, 'APIdown could not complete that lookup. Try again shortly.');
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}
