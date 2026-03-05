import { createRedisClient } from './lib/redis.js';
import { createSupabaseClient } from './lib/supabase.js';
import { drainSignals } from './lib/signal-drain.js';
import { runAnomalyDetection } from './lib/anomaly-detector.js';
import { drainAlerts } from './lib/alert-worker.js';

const SIGNAL_INTERVAL = 10_000;   // Drain signals every 10s
const ANOMALY_INTERVAL = 60_000;  // Run anomaly detection every 60s
const ALERT_INTERVAL   = 15_000;  // Process alerts every 15s

async function start() {
  console.log('[worker] Starting APIdown worker...');

  const redis = createRedisClient();
  const supabase = createSupabaseClient();

  // Signal drain loop: Redis → Supabase
  async function signalLoop() {
    try {
      await drainSignals(redis, supabase);
    } catch (err) {
      console.error('[worker] Signal drain error:', err.message);
    }
  }

  // Anomaly detection loop
  async function anomalyLoop() {
    try {
      await runAnomalyDetection(supabase);
    } catch (err) {
      console.error('[worker] Anomaly detection error:', err.message);
    }
  }

  // Alert sending loop
  async function alertLoop() {
    try {
      await drainAlerts(redis, supabase);
    } catch (err) {
      console.error('[worker] Alert worker error:', err.message);
    }
  }

  // Run initial drain
  await signalLoop();

  // Schedule recurring loops
  setInterval(signalLoop, SIGNAL_INTERVAL);
  setInterval(anomalyLoop, ANOMALY_INTERVAL);
  setInterval(alertLoop, ALERT_INTERVAL);

  console.log('[worker] All loops running');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[worker] Shutting down...');
    await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();
