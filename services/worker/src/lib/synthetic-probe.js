const REGIONS = ['us-east', 'eu-west', 'ap-south'];
const PROBE_TIMEOUT = 10_000;
const CONCURRENCY_LIMIT = 10;
const SDK_SIGNAL_THRESHOLD = 10;
const SDK_REPORTER_THRESHOLD = 3;
const API_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Domains that require account-specific subdomains and can't be probed at root
const UNPROBEABLE_DOMAINS = [
  'blob.core.windows.net',      // Needs {account}.blob.core.windows.net
  'documents.azure.com',         // Needs {account}.documents.azure.com
  'r2.cloudflarestorage.com',    // Needs {account}.r2.cloudflarestorage.com
];

let cachedApis = [];
let lastApiRefresh = 0;
let rpcMissing = false; // Suppress repeated RPC error logs

/**
 * Run synthetic probes against all monitored APIs.
 * Each API is probed from 3 simulated regions via HTTPS HEAD/GET.
 * Backs off if the API has sufficient SDK signals.
 */
export async function runSyntheticProbes(supabase) {
  await refreshApiList(supabase);

  if (cachedApis.length === 0) {
    console.log('[probe] No APIs to probe');
    return;
  }

  // Check which APIs have enough SDK signals to skip
  const skipSet = await getApisWithSdkCoverage(supabase);

  const apisToProbe = cachedApis.filter(api => !skipSet.has(api.id));
  console.log(`[probe] Probing ${apisToProbe.length}/${cachedApis.length} APIs (${skipSet.size} backed off due to SDK coverage)`);

  // Run probes with concurrency limit
  const signals = [];
  for (let i = 0; i < apisToProbe.length; i += CONCURRENCY_LIMIT) {
    const batch = apisToProbe.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.allSettled(
      batch.flatMap(api => REGIONS.map(region => probeApi(api, region)))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        signals.push(result.value);
      }
    }
  }

  if (signals.length === 0) return;

  // Batch insert signals directly into Supabase
  const { error } = await supabase.from('signals').insert(signals);
  if (error) {
    console.error('[probe] Failed to insert signals:', error.message);
  } else {
    console.log(`[probe] Inserted ${signals.length} synthetic signals`);
  }
}

async function refreshApiList(supabase) {
  const now = Date.now();
  if (now - lastApiRefresh < API_REFRESH_INTERVAL && cachedApis.length > 0) return;

  const { data, error } = await supabase
    .from('apis')
    .select('id, slug, name, base_domains');

  if (error) {
    console.error('[probe] Failed to refresh API list:', error.message);
    return;
  }

  cachedApis = (data || []).filter(api => {
    if (!api.base_domains || api.base_domains.length === 0) return false;
    // Skip domains that require account-specific subdomains
    const domain = api.base_domains[0];
    return !UNPROBEABLE_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
  });
  lastApiRefresh = now;
  console.log(`[probe] Loaded ${cachedApis.length} APIs for probing`);
}

/**
 * Check which APIs have enough recent SDK signals to skip probing.
 * Returns a Set of api_ids that have 10+ signals from 3+ distinct non-synth reporters in the last 5 min.
 */
async function getApisWithSdkCoverage(supabase) {
  const skipSet = new Set();

  // Skip RPC if we already know it doesn't exist
  if (rpcMissing) {
    return await getApisWithSdkCoverageFallback(supabase);
  }

  const { data, error } = await supabase.rpc('get_sdk_coverage_apis', {
    p_min_signals: SDK_SIGNAL_THRESHOLD,
    p_min_reporters: SDK_REPORTER_THRESHOLD,
    p_minutes: 5,
  });

  if (error) {
    // RPC might not exist yet — fall back to manual query
    if (error.message.includes('does not exist')) {
      rpcMissing = true;
      return await getApisWithSdkCoverageFallback(supabase);
    }
    console.error('[probe] SDK coverage check failed:', error.message);
    return skipSet;
  }

  for (const row of data || []) {
    skipSet.add(row.api_id);
  }
  return skipSet;
}

async function getApisWithSdkCoverageFallback(supabase) {
  const skipSet = new Set();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('signals')
    .select('api_id, reporter_hash')
    .gt('time', fiveMinAgo)
    .not('reporter_hash', 'like', 'synth-%');

  if (error || !data) return skipSet;

  // Group by api_id: count signals and distinct reporters
  const apiStats = new Map();
  for (const row of data) {
    if (!apiStats.has(row.api_id)) {
      apiStats.set(row.api_id, { count: 0, reporters: new Set() });
    }
    const stats = apiStats.get(row.api_id);
    stats.count++;
    stats.reporters.add(row.reporter_hash);
  }

  for (const [apiId, stats] of apiStats) {
    if (stats.count >= SDK_SIGNAL_THRESHOLD && stats.reporters.size >= SDK_REPORTER_THRESHOLD) {
      skipSet.add(apiId);
    }
  }
  return skipSet;
}

/**
 * Probe a single API from a simulated region.
 * Tries HEAD first, falls back to GET on 405.
 */
async function probeApi(api, region) {
  const domain = api.base_domains[0];
  const url = `https://${domain}`;
  const reporterHash = `synth-${region}`;

  const start = Date.now();
  let statusCode;

  try {
    // Try HEAD first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT);

    let response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'APIdown-Probe/1.0' },
      });
    } finally {
      clearTimeout(timeout);
    }

    // Fall back to GET if HEAD not allowed
    if (response.status === 405) {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), PROBE_TIMEOUT);
      try {
        response = await fetch(url, {
          method: 'GET',
          signal: controller2.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'APIdown-Probe/1.0' },
        });
      } finally {
        clearTimeout(timeout2);
      }
    }

    // Any HTTP response means the server is alive and reachable.
    // Only 5xx indicates a server-side problem.
    const code = response.status;
    if (code >= 500) {
      statusCode = 503;
    } else {
      statusCode = 200;
    }
  } catch (err) {
    // Timeout, DNS failure, connection refused = down
    statusCode = 503;
  }

  const durationMs = Date.now() - start;

  return {
    api_id: api.id,
    region,
    status_code: statusCode,
    duration_ms: durationMs,
    reporter_hash: reporterHash,
    sdk_version: 'synthetic-v1',
  };
}
