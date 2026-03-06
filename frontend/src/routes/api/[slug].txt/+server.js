import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function GET({ params, platform }) {
    setPlatform(platform);
    const supabaseAdmin = getSupabaseAdmin();
    const { slug } = params;

    const { data: api } = await supabaseAdmin
        .from('apis')
        .select('*')
        .eq('slug', slug)
        .single();

    if (!api) throw error(404, 'API not found');

    // Last 5 min for current metrics
    const { data: recentData } = await supabaseAdmin
        .from('signals_1min')
        .select('error_count, total_signals, p50_ms, p95_ms, region')
        .eq('api_id', api.id)
        .gte('bucket', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    // 24h for averages
    const { data: dayData } = await supabaseAdmin
        .from('signals_1min')
        .select('error_count, total_signals, p50_ms, p95_ms, region')
        .eq('api_id', api.id)
        .gte('bucket', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Recent incidents
    const { data: incidents } = await supabaseAdmin
        .from('incidents')
        .select('title, severity, status, started_at, resolved_at')
        .eq('api_id', api.id)
        .order('started_at', { ascending: false })
        .limit(10);

    // 90-day uptime
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: uptimeIncidents } = await supabaseAdmin
        .from('incidents')
        .select('started_at, resolved_at')
        .eq('api_id', api.id)
        .gte('started_at', ninetyDaysAgo);

    let downtimeMs = 0;
    for (const inc of (uptimeIncidents || [])) {
        const start = new Date(inc.started_at).getTime();
        const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now();
        downtimeMs += end - start;
    }
    const uptimePercent = ((1 - downtimeMs / (90 * 24 * 60 * 60 * 1000)) * 100).toFixed(3);

    // Calculate metrics
    function calcMetrics(data) {
        let totalSignals = 0, errorCount = 0, p50Sum = 0, p95Sum = 0, count = 0;
        const regions = new Set();
        for (const d of (data || [])) {
            totalSignals += d.total_signals || 0;
            errorCount += d.error_count || 0;
            if (d.p50_ms) { p50Sum += d.p50_ms; count++; }
            if (d.p95_ms) { p95Sum += d.p95_ms; }
            if (d.region) regions.add(d.region);
        }
        return {
            errorRate: totalSignals > 0 ? ((errorCount / totalSignals) * 100).toFixed(2) : '0.00',
            p50: count > 0 ? Math.round(p50Sum / count) : 0,
            p95: count > 0 ? Math.round(p95Sum / count) : 0,
            regions: Array.from(regions),
        };
    }

    const current = calcMetrics(recentData);
    const daily = calcMetrics(dayData);

    const statusWord = {
        operational: 'OPERATIONAL (No issues detected)',
        degraded: 'DEGRADED (Elevated errors or latency)',
        down: 'DOWN (Major outage in progress)'
    };

    const incidentList = (incidents || []).map(inc => {
        const resolved = inc.resolved_at
            ? `resolved ${new Date(inc.resolved_at).toISOString()}`
            : 'ongoing';
        return `  - [${inc.severity.toUpperCase()}] ${inc.title} (${inc.status}, ${resolved})`;
    }).join('\n');

    const text = `# ${api.name} API Status
> Source: APIdown.net — Real-time API monitoring from production traffic
> URL: https://apidown.net/api/${slug}
> Updated: ${new Date().toISOString()}
> Data: Crowd-sourced from real developer production traffic (not synthetic pings)

## Current Status
Status: ${statusWord[api.current_status] || api.current_status}
Category: ${api.category}
${api.base_url ? `Base URL: ${api.base_url}` : ''}
${api.status_page ? `Vendor Status Page: ${api.status_page}` : ''}

## Is ${api.name} Down Right Now?
${api.current_status === 'operational'
    ? `No. ${api.name} API is currently operational. As of ${new Date().toISOString()}, all monitored endpoints are responding normally with a ${current.errorRate}% error rate and ${current.p50}ms median latency.`
    : `Yes. ${api.name} API is currently ${api.current_status}. Real-time error rate: ${current.errorRate}%. P95 latency: ${current.p95}ms.${incidents?.length > 0 ? ` Latest incident: ${incidents[0].title}.` : ''}`
}

## Performance Metrics

### Current (Last 5 Minutes)
- Error Rate: ${current.errorRate}%
- Median Latency (P50): ${current.p50}ms
- P95 Latency: ${current.p95}ms
- Active Regions: ${current.regions.length > 0 ? current.regions.join(', ') : 'no data'}

### 24-Hour Average
- Error Rate: ${daily.errorRate}%
- Median Latency (P50): ${daily.p50}ms
- P95 Latency: ${daily.p95}ms
- Reporting Regions: ${daily.regions.length > 0 ? daily.regions.join(', ') : 'no data'}

### Reliability
- 90-Day Uptime: ${uptimePercent}%
- Total Incidents (90 days): ${(uptimeIncidents || []).length}

## Recent Incidents
${incidentList || '  No incidents recorded.'}

## Frequently Asked Questions

### Is ${api.name} down right now?
${api.current_status === 'operational'
    ? `No, ${api.name} API is currently operational with ${uptimePercent}% uptime over the last 90 days.`
    : `Yes, ${api.name} API is experiencing issues. Current status: ${api.current_status}.`
}

### What is the ${api.name} API uptime?
${api.name} API has ${uptimePercent}% uptime over the last 90 days, measured from real production traffic.

### What is the average ${api.name} API latency?
Median (P50) latency: ${daily.p50}ms. P95 latency: ${daily.p95}ms (24-hour average).

### How does APIdown monitor ${api.name}?
APIdown uses crowd-sourced telemetry from real production API calls — not synthetic health checks. Developers install a lightweight SDK that reports actual request outcomes, giving a true picture of the developer experience.

## Machine-Readable Endpoints
- JSON Status: https://apidown.net/api-status/${slug}
- SLA Report: https://apidown.net/api-status/${slug}/sla
- Status Badge: https://apidown.net/api/${slug}/badge.svg
- This Document: https://apidown.net/api/${slug}.txt

## About APIdown.net
APIdown.net provides real-time, crowd-sourced API health monitoring. Unlike vendor status pages that may underreport issues, APIdown uses telemetry from actual production traffic to detect outages, measure latency, and track reliability across ${api.name} and 30+ other popular APIs.

Learn more: https://apidown.net
Full documentation: https://apidown.net/llms-full.txt
`;

    return new Response(text, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=60',
        }
    });
}
