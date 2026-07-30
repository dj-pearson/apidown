import { buildDigest, weekWindow } from '$lib/weekly-digest.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fetches the rows a weekly digest needs and hands them to the pure builder.
 * Shared by the /weekly archive pages and the /v1/weekly endpoint the worker
 * reads when sending the email, so the web and email versions can never drift.
 */
export async function loadDigest(supabase, week, now = Date.now()) {
  const { start, end } = weekWindow(week);
  const priorStart = start - WEEK_MS;

  const [{ data: apis }, { data: incidents }, { data: latency }] = await Promise.all([
    supabase
      .from('apis')
      .select('id, slug, name, category')
      .is('owner_id', null)
      .order('name'),
    supabase
      .from('incidents')
      .select('id, api_id, severity, status, title, started_at, resolved_at')
      .lt('started_at', new Date(end).toISOString())
      .or(`resolved_at.gte.${new Date(start).toISOString()},resolved_at.is.null`)
      .order('started_at', { ascending: false }),
    // Two weeks of p95 in one query, split below, to compare like with like.
    supabase
      .from('signals_1min')
      .select('api_id, bucket, p95_ms, total_signals')
      .gte('bucket', new Date(priorStart).toISOString())
      .lt('bucket', new Date(end).toISOString()),
  ]);

  const latencyThisWeek = [];
  const latencyPriorWeek = [];
  for (const row of latency || []) {
    const t = new Date(row.bucket).getTime();
    if (t >= start) latencyThisWeek.push(row);
    else latencyPriorWeek.push(row);
  }

  return buildDigest({
    week,
    apis: apis || [],
    incidents: incidents || [],
    latencyThisWeek,
    latencyPriorWeek,
    now,
  });
}
