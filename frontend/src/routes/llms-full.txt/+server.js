import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';

export async function GET({ platform }) {
  setPlatform(platform);
  const supabase = getSupabaseAdmin();
  const { data: apis } = await supabase
    .from('apis')
    .select('slug, name, category, base_domains, current_status, status_page')
    .order('category')
    .order('name');

  const { data: incidents } = await supabase
    .from('incidents')
    .select('title, severity, status, started_at, resolved_at')
    .order('started_at', { ascending: false })
    .limit(20);

  const categoryLabels = {
    payments: 'Payments',
    ai: 'AI / LLM',
    communications: 'Communications',
    'cloud-aws': 'Cloud — AWS',
    'cloud-gcp': 'Cloud — GCP',
    'cloud-azure': 'Cloud — Azure',
    auth: 'Auth & Identity',
    database: 'Database / Storage',
    devtools: 'Dev Tools & Hosting',
    commerce: 'Commerce & Shipping',
  };

  let body = `# APIdown.net — Full Documentation

> Real-time API health status powered by crowd-sourced production traffic.

## Overview

APIdown.net is a crowd-sourced API health monitoring platform. Developers integrate a lightweight JavaScript SDK into their applications, which passively reports API response metadata (status codes, latency, region) to our ingest service. This data is aggregated and analyzed to detect anomalies and create incidents — providing an unbiased, real-time view of API health independent of vendor status pages.

## How It Works

1. **SDK Integration**: Developers install the @apidown/sdk npm package and wrap their HTTP client (fetch, axios, etc.)
2. **Signal Collection**: The SDK reports non-sensitive metadata: API domain, HTTP status code, response time, and geographic region
3. **Aggregation**: Signals are bucketed into 1-minute windows and aggregated by API and region
4. **Anomaly Detection**: A Z-score based detector compares current error rates and latency against 30-day rolling baselines
5. **Incident Management**: When anomalies exceed thresholds, incidents are automatically created and resolved
6. **Alerting**: Subscribers receive notifications via email, Slack, Discord, PagerDuty, or Microsoft Teams

## Architecture

- **Frontend**: SvelteKit 5 on Cloudflare Pages
- **Ingest API**: Fastify 5 (Node.js) behind Docker/reverse proxy
- **Worker**: Node.js background service for aggregation, anomaly detection, and alert dispatch
- **Database**: PostgreSQL with TimescaleDB (self-hosted Supabase)
- **Cache/Queue**: Redis for signal buffering and alert queuing

## JSON API

### GET /api-status
Returns current status of all monitored APIs.

Example response:
\`\`\`json
{
  "ok": true,
  "generated_at": "2026-03-05T12:00:00Z",
  "apis": [
    {
      "slug": "stripe",
      "name": "Stripe",
      "category": "payments",
      "status": "operational"
    }
  ]
}
\`\`\`

### GET /api-status/[slug]
Returns detailed status for a specific API including recent incidents and latency data.

## SDK Integration

\`\`\`javascript
import { initAPIDown } from '@apidown/sdk';

// Initialize once at app startup
initAPIDown({ apiKey: 'your-api-key' });

// The SDK automatically intercepts fetch calls and reports signals
const response = await fetch('https://api.stripe.com/v1/charges');
\`\`\`

`;

  // Add current API statuses
  body += `## Monitored APIs\n\n`;

  const grouped = {};
  for (const api of (apis || [])) {
    const cat = categoryLabels[api.category] || api.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(api);
  }

  for (const [category, categoryApis] of Object.entries(grouped)) {
    body += `### ${category}\n\n`;
    for (const api of categoryApis) {
      const domains = (api.base_domains || []).join(', ');
      const statusPage = api.status_page ? ` | Vendor status: ${api.status_page}` : '';
      body += `- **${api.name}** (${api.slug}): ${api.current_status} — Domains: ${domains}${statusPage}\n`;
      body += `  URL: https://apidown.net/api/${api.slug}\n`;
    }
    body += `\n`;
  }

  // Add recent incidents
  body += `## Recent Incidents (Last 20)\n\n`;
  if (incidents && incidents.length > 0) {
    for (const inc of incidents) {
      const resolved = inc.resolved_at ? ` → Resolved: ${inc.resolved_at}` : ' (ongoing)';
      body += `- [${inc.severity}] ${inc.title} — Status: ${inc.status} — Started: ${inc.started_at}${resolved}\n`;
    }
  } else {
    body += `No recent incidents.\n`;
  }

  body += `
## URLs

- Homepage: https://apidown.net
- Incidents: https://apidown.net/incidents
- Documentation: https://apidown.net/docs
- Pricing: https://apidown.net/pricing
- JSON API: https://apidown.net/api-status
- Sitemap: https://apidown.net/sitemap.xml
- LLMs.txt: https://apidown.net/llms.txt
- GitHub: https://github.com/dj-pearson/apidown

## Contact

- Website: https://apidown.net
- GitHub: https://github.com/dj-pearson/apidown
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
