const SCRAPE_TIMEOUT = 15_000;
const REGIONS = ['us-east', 'eu-west', 'ap-south'];

/**
 * Scrape vendor status pages for supplementary monitoring data.
 * Most APIs use Atlassian Statuspage format → {status_page}/api/v2/status.json
 */
export async function runStatusPageScraper(supabase) {
  const { data: apis, error } = await supabase
    .from('apis')
    .select('id, slug, name, status_page, current_status');

  if (error) {
    console.error('[scrape] Failed to load APIs:', error.message);
    return;
  }

  const apisWithStatusPage = (apis || []).filter(api => api.status_page);
  if (apisWithStatusPage.length === 0) {
    console.log('[scrape] No APIs with status pages configured');
    return;
  }

  console.log(`[scrape] Checking ${apisWithStatusPage.length} status pages`);

  const signals = [];

  const results = await Promise.allSettled(
    apisWithStatusPage.map(api => scrapeStatusPage(api))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const api = apisWithStatusPage[i];

    if (result.status !== 'fulfilled' || !result.value) continue;

    const { indicator, description } = result.value;
    const isVendorDown = indicator === 'major' || indicator === 'critical';
    const isVendorDegraded = indicator === 'minor';

    if (isVendorDown && api.current_status === 'operational') {
      // Vendor reports outage but we show operational — inject error signals to boost detection
      console.log(`[scrape] ${api.slug}: vendor reports ${indicator}, injecting error signals`);
      for (const region of REGIONS) {
        signals.push({
          api_id: api.id,
          region,
          status_code: 503,
          duration_ms: SCRAPE_TIMEOUT,
          reporter_hash: `synth-${region}`,
          sdk_version: 'statuspage-v1',
        });
      }
    } else if (isVendorDegraded && api.current_status === 'operational') {
      console.log(`[scrape] ${api.slug}: vendor reports minor degradation (${description})`);
    } else if (!isVendorDown && !isVendorDegraded && api.current_status !== 'operational') {
      console.log(`[scrape] ${api.slug}: vendor reports OK but we show ${api.current_status} — may auto-resolve`);
    } else {
      console.log(`[scrape] ${api.slug}: vendor=${indicator}, ours=${api.current_status}`);
    }
  }

  if (signals.length > 0) {
    const { error: insertErr } = await supabase.from('signals').insert(signals);
    if (insertErr) {
      console.error('[scrape] Failed to insert signals:', insertErr.message);
    } else {
      console.log(`[scrape] Inserted ${signals.length} status-page-derived signals`);
    }
  }
}

/**
 * Scrape a single vendor status page.
 * Tries Atlassian Statuspage API format first.
 */
async function scrapeStatusPage(api) {
  const statusPageUrl = api.status_page.replace(/\/+$/, '');

  // Skip non-Atlassian formats for now (AWS, Azure)
  if (statusPageUrl.includes('health.aws.amazon.com') || statusPageUrl.includes('azure.status.microsoft')) {
    // TODO: Add specialized parsers for AWS and Azure
    return null;
  }

  const apiUrl = `${statusPageUrl}/api/v2/status.json`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT);

    let response;
    try {
      response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'APIdown-StatusScraper/1.0',
          'Accept': 'application/json',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Atlassian Statuspage format: { status: { indicator, description } }
    if (data?.status?.indicator) {
      return {
        indicator: data.status.indicator,  // none | minor | major | critical
        description: data.status.description || '',
      };
    }

    return null;
  } catch (err) {
    // Silently log scraping errors — don't affect monitoring
    if (err.name !== 'AbortError') {
      console.error(`[scrape] Error scraping ${api.slug}:`, err.message);
    }
    return null;
  }
}
