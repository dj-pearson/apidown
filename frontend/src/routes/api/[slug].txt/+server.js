import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { error } from '@sveltejs/kit';

export async function GET({ params, platform }) {
    setPlatform(platform);
    const supabaseAdmin = getSupabaseAdmin();
    const { slug } = params;

    // Verify API exists
    const { data: api } = await supabaseAdmin
        .from('apis')
        .select('*')
        .eq('slug', slug)
        .single();

    if (!api) throw error(404, 'API not found');

    // Get recent 24h data to calculate current metrics
    const { data: latencyData } = await supabaseAdmin
        .from('signals_1min')
        .select('error_count, total_signals, p95_ms, region')
        .eq('api_id', api.id)
        .gte('bucket', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes for "current" status

    let totalSignals = 0;
    let errorCount = 0;
    let p95Sum = 0;
    let p95Count = 0;
    const regions = new Set();

    if (latencyData) {
        for (const d of latencyData) {
            totalSignals += d.total_signals || 0;
            errorCount += d.error_count || 0;
            if (d.p95_ms) {
                p95Sum += d.p95_ms;
                p95Count++;
            }
            if (d.region) regions.add(d.region);
        }
    }

    const errorRate = totalSignals > 0 ? ((errorCount / totalSignals) * 100).toFixed(1) : 0;
    const avgP95 = p95Count > 0 ? Math.round(p95Sum / p95Count) : 0;
    const affectedRegions = regions.size > 0 ? Array.from(regions).join(', ') : 'unknown';

    const severityMap = {
        operational: 'None',
        degraded: 'Minor',
        down: 'Major/Critical'
    };

    const markdownContent = `# Current ${api.name} API Status
Status: ${api.current_status.toUpperCase()}
Severity: ${severityMap[api.current_status]}
Error Rate: ${errorRate}%
P95 Latency: ${avgP95}ms
Affected Regions: ${affectedRegions}
Time: ${new Date().toISOString()}
Source: APIDown (Real traffic telemetry - https://apidown.net/api/${slug})
`;

    return new Response(markdownContent, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=60' // Cache for 60 seconds
        }
    });
}
