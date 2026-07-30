import { getSupabaseAdmin, setPlatform } from '$lib/supabase-server.js';
import { v1Json, v1Error, v1Options } from '$lib/server/v1.js';
import { loadDigest } from '$lib/server/digest-query.js';
import { isValidWeekKey, weekWindow, recentWeekKeys } from '$lib/weekly-digest.js';

export const OPTIONS = v1Options;

/**
 * GET /v1/weekly/:week — the same digest the /weekly page renders.
 * Pass "latest" for the most recent complete week. The worker reads this when
 * sending the email, so the web and inbox versions cannot drift apart.
 */
export async function GET({ params, platform }) {
  setPlatform(platform);

  const now = Date.now();
  const week = params.week === 'latest' ? recentWeekKeys(1, now)[0] : params.week;

  if (!isValidWeekKey(week)) {
    return v1Error('invalid_week', 'week must be an ISO week key like 2026-W31, or "latest"', 400);
  }
  if (weekWindow(week).start > now) {
    return v1Error('not_found', `${week} hasn't happened yet`, 404);
  }

  try {
    const digest = await loadDigest(getSupabaseAdmin(), week, now);
    const isComplete = weekWindow(week).end <= now;
    return v1Json(digest, {
      meta: {
        week,
        complete: isComplete,
        url: `https://apidown.net/weekly/${week}`,
        source: 'crowd-sourced client-side signals',
      },
      // A finished week is immutable; the current one keeps changing.
      maxAge: isComplete ? 86400 : 900,
    });
  } catch (err) {
    console.error('[APIdown] /v1/weekly error:', err?.message || err);
    return v1Error('internal_error', 'Failed to build the weekly digest', 500);
  }
}
