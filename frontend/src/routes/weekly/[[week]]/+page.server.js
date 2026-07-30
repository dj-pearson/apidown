import { error } from '@sveltejs/kit';
import { getSupabaseAdmin } from '$lib/supabase-server.js';
import { loadDigest } from '$lib/server/digest-query.js';
import {
  isValidWeekKey,
  recentWeekKeys,
  weekWindow,
  previousWeekKey,
  nextWeekKey,
} from '$lib/weekly-digest.js';

/**
 * /weekly            → the most recent complete week
 * /weekly/2026-W31   → that week's archived digest
 */
export async function load({ params, setHeaders }) {
  const now = Date.now();
  const latest = recentWeekKeys(1, now)[0];
  const week = params.week || latest;

  if (!isValidWeekKey(week)) throw error(404, 'Not a valid week — expected YYYY-Www');
  if (weekWindow(week).start > now) throw error(404, "That week hasn't happened yet");

  // Finished weeks never change, so they cache hard.
  const isLatest = week === latest;
  setHeaders({
    'cache-control': isLatest
      ? 'public, max-age=900, s-maxage=1800'
      : 'public, max-age=3600, s-maxage=86400',
  });

  const next = nextWeekKey(week);

  try {
    const digest = await loadDigest(getSupabaseAdmin(), week, now);
    return {
      digest,
      isLatest,
      canonicalWeek: week,
      prevWeek: previousWeekKey(week),
      nextWeek: weekWindow(next).start <= now ? next : null,
      archive: recentWeekKeys(12, now),
    };
  } catch (err) {
    console.error('[APIdown] Weekly digest load error:', err?.message || err);
    throw error(503, 'The weekly digest is temporarily unavailable');
  }
}
