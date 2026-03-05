/**
 * Maintenance tasks previously handled by TimescaleDB policies.
 * Apache-licensed TimescaleDB doesn't support continuous aggregates
 * or retention policies, so the worker manages these instead.
 */

/**
 * Refresh the signals_1min materialized view.
 * Uses CONCURRENTLY so reads aren't blocked during refresh.
 */
export async function refreshMaterializedView(supabase) {
  const { error } = await supabase.rpc('refresh_signals_1min');
  if (error) {
    // Fallback: if the RPC doesn't exist yet, log it
    console.error('[maintenance] View refresh failed:', error.message);
    return;
  }
  console.log('[maintenance] signals_1min refreshed');
}

/**
 * Delete raw signals older than 90 days.
 * Runs daily to keep the hypertable size manageable.
 */
export async function runRetention(supabase) {
  const { error } = await supabase.rpc('cleanup_old_signals');
  if (error) {
    console.error('[maintenance] Retention cleanup failed:', error.message);
    return;
  }
  console.log('[maintenance] Old signals cleaned up (>90 days)');
}
