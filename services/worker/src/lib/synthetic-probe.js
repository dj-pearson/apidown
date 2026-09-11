import { lookup } from 'node:dns/promises';
import { decryptProbeAuth } from './probe-crypto.js';
import { parseProbeUrl, isBlockedIp, sameOrigin } from './safe-url.js';

const REGIONS = ['us-east', 'eu-west', 'ap-south'];
const PROBE_TIMEOUT = 10_000;
const CONCURRENCY_LIMIT = 10;
const SDK_SIGNAL_THRESHOLD = 10;
const SDK_REPORTER_THRESHOLD = 3;
const API_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_REDIRECTS = 3;

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
    .select('id, slug, name, base_domains, probe_url, expected_status, probe_auth_encrypted');

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
  const url = api.probe_url || `https://${domain}`;
  const expectedStatus = api.expected_status || 200;
  const reporterHash = `synth-${region}`;

  // Build headers — include decrypted auth if present
  const headers = { 'User-Agent': 'APIdown-Probe/1.0' };

  if (api.probe_auth_encrypted) {
    const decrypted = decryptProbeAuth(api.probe_auth_encrypted);
    if (decrypted) {
      const colonIdx = decrypted.indexOf(': ');
      if (colonIdx > 0) {
        headers[decrypted.slice(0, colonIdx)] = decrypted.slice(colonIdx + 2);
      }
    }
  }

  const start = Date.now();
  let statusCode;

  try {
    // Use GET for custom APIs with probe_url (need real status), HEAD for system APIs
    const useGet = !!api.probe_url;

    let response = await probeFetch(url, useGet ? 'GET' : 'HEAD', headers);

    // Fall back to GET if HEAD not allowed
    if (!useGet && response.status === 405) {
      response = await probeFetch(url, 'GET', headers);
    }

    const code = response.status;
    if (api.probe_url) {
      // Custom API: check against expected status
      statusCode = code === expectedStatus ? 200 : 503;
    } else {
      // System API: any non-5xx = healthy
      statusCode = code >= 500 ? 503 : 200;
    }
  } catch (err) {
    // Timeout, DNS failure, connection refused = down. A URL that fails the
    // safety check is not evidence about the API, so it is reported as an
    // error rather than an outage.
    if (err?.code === 'PROBE_UNSAFE') {
      console.error(`[probe] Refusing to fetch ${api.slug}: ${err.message}`);
      return null;
    }
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

/**
 * Fetch a probe target with the redirect chain under our own control.
 *
 * `redirect: 'follow'` hands two things to whoever controls the endpoint: it
 * will chase a redirect into the private network however carefully the
 * original URL was screened, and it re-sends the request headers — including
 * the customer's decrypted auth credential — to wherever it lands. So each hop
 * is validated here, and the credential is dropped the moment the origin
 * changes.
 */
async function probeFetch(startUrl, method, headers) {
  let current = startUrl;
  let currentHeaders = headers;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeTarget(current);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
    let response;
    try {
      response = await fetch(current, {
        method,
        signal: controller.signal,
        redirect: 'manual',
        headers: currentHeaders,
      });
    } finally {
      clearTimeout(timeout);
    }

    const location = response.status >= 300 && response.status < 400
      ? response.headers.get('location')
      : null;
    if (!location) return response;

    const next = new URL(location, current).toString();
    if (!sameOrigin(current, next)) {
      // Never carry a credential to another origin.
      currentHeaders = { 'User-Agent': currentHeaders['User-Agent'] || 'APIdown-Probe/1.0' };
    }
    current = next;
  }

  const err = new Error(`more than ${MAX_REDIRECTS} redirects`);
  err.code = 'PROBE_UNSAFE';
  throw err;
}

/**
 * Re-check the target immediately before fetching it. The hostname was
 * screened when the custom API was created, but DNS can be repointed at a
 * private address afterwards, and a redirect target has never been screened at
 * all — so the resolved address is what gets checked here.
 */
async function assertSafeTarget(target) {
  const validated = parseProbeUrl(target);
  if (!validated.ok) {
    const err = new Error(`${target} — ${validated.reason}`);
    err.code = 'PROBE_UNSAFE';
    throw err;
  }

  let addresses;
  try {
    addresses = await lookup(validated.url.hostname, { all: true });
  } catch {
    return; // Unresolvable: the fetch will fail on its own and count as down.
  }

  const blocked = addresses.find(a => isBlockedIp(a.address));
  if (blocked) {
    const err = new Error(`${validated.url.hostname} resolves to the private address ${blocked.address}`);
    err.code = 'PROBE_UNSAFE';
    throw err;
  }
}
