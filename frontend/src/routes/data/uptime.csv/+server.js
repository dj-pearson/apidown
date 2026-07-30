import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { toCsv, dataResponse } from '$lib/server/datasets.js';
import { buildUptimeRows, UPTIME_COLUMNS } from '$lib/server/uptime-dataset.js';

/** GET /data/uptime.csv — monthly uptime per API, one row per API-month. */
export async function GET({ platform }) {
  setPlatform(platform);

  try {
    const rows = await buildUptimeRows(getSupabaseAdmin());
    return dataResponse(toCsv(UPTIME_COLUMNS, rows), 'text/csv; charset=utf-8', 'apidown-monthly-uptime.csv');
  } catch (err) {
    console.error('[APIdown] uptime.csv error:', err?.message || err);
    return new Response('Dataset temporarily unavailable', { status: 500 });
  }
}
