import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { dataResponse, UPTIME_MONTHS } from '$lib/server/datasets.js';
import { buildUptimeRows } from '$lib/server/uptime-dataset.js';

/** GET /data/uptime.json — monthly uptime per API, one row per API-month. */
export async function GET({ platform }) {
  setPlatform(platform);

  try {
    const rows = await buildUptimeRows(getSupabaseAdmin());
    const body = JSON.stringify({
      dataset: 'apidown-monthly-uptime',
      generated_at: new Date().toISOString(),
      months_covered: UPTIME_MONTHS,
      row_count: rows.length,
      attribution: 'APIdown.net — https://apidown.net/data',
      measurement_note:
        'Uptime is derived from incidents detected in anonymised client-side signals, clipped to each calendar month. Overlapping incidents are merged.',
      rows,
    });
    return dataResponse(body, 'application/json; charset=utf-8', 'apidown-monthly-uptime.json');
  } catch (err) {
    console.error('[APIdown] uptime.json error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Dataset temporarily unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
