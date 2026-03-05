import { createRedisClient } from './lib/redis.js';
import { createSupabaseClient } from './lib/supabase.js';
import { drainSignals } from './lib/signal-drain.js';
import { runAnomalyDetection, setRedis } from './lib/anomaly-detector.js';
import { drainAlerts } from './lib/alert-worker.js';
import { refreshMaterializedView, runRetention } from './lib/maintenance.js';
import { runDigestAlerts } from './lib/digest-worker.js';

const SIGNAL_INTERVAL = 10_000;   // Drain signals every 10s
const ANOMALY_INTERVAL = 60_000;  // Run anomaly detection every 60s
const ALERT_INTERVAL   = 15_000;  // Process alerts every 15s
const REFRESH_INTERVAL = 60_000;  // Refresh materialized view every 60s
const DIGEST_INTERVAL  = 60 * 60 * 1000; // Digest alerts every hour
const RETENTION_INTERVAL = 24 * 60 * 60 * 1000; // Retention cleanup daily

async function start() {
  console.log('[worker] Starting APIdown worker...');

  const redis = createRedisClient();
  const supabase = createSupabaseClient();

  // Wire Redis into anomaly detector for alert queueing
  setRedis(redis);

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

  // Materialized view refresh loop
  async function refreshLoop() {
    try {
      await refreshMaterializedView(supabase);
    } catch (err) {
      console.error('[worker] View refresh error:', err.message);
    }
  }

  // Retention cleanup loop (daily)
  async function retentionLoop() {
    try {
      await runRetention(supabase);
    } catch (err) {
      console.error('[worker] Retention error:', err.message);
    }
  }

  // Run initial drain
  await signalLoop();

  // Digest alert loop
  async function digestLoop() {
    try {
      await runDigestAlerts(supabase);
    } catch (err) {
      console.error('[worker] Digest alert error:', err.message);
    }
  }

  // Schedule recurring loops
  setInterval(signalLoop, SIGNAL_INTERVAL);
  setInterval(anomalyLoop, ANOMALY_INTERVAL);
  setInterval(alertLoop, ALERT_INTERVAL);
  setInterval(refreshLoop, REFRESH_INTERVAL);
  setInterval(digestLoop, DIGEST_INTERVAL);
  setInterval(retentionLoop, RETENTION_INTERVAL);

  // Simple health HTTP server for container probes
  const http = await import('http');
  const healthPort = parseInt(process.env.HEALTH_PORT || '3002', 10);
  http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'apidown-worker', timestamp: new Date().toISOString() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(healthPort, () => {
    console.log(`[worker] Health endpoint on :${healthPort}/health`);
  });

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
