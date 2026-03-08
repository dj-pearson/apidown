<script>
  let { data } = $props();
  const { page, apis, uptimeData, latencyData, recentIncidents, overallUptime } = data;

  let subscribing = $state(false);
  let subEmail = $state('');
  let subSuccess = $state(false);
  let subError = $state('');

  const allOperational = $derived(
    apis.length > 0 && apis.every(a => a.status === 'operational')
  );
  const hasDown = $derived(apis.some(a => a.status === 'down'));
  const hasDegraded = $derived(apis.some(a => a.status === 'degraded'));

  function overallLabel() {
    if (apis.length === 0) return 'No APIs monitored';
    if (allOperational) return 'All Systems Operational';
    if (hasDown) return 'Some Systems Experiencing Issues';
    if (hasDegraded) return 'Some Systems Degraded';
    return 'Partial Issues Detected';
  }

  function overallClass() {
    if (allOperational) return 'overall-ok';
    if (hasDown) return 'overall-down';
    return 'overall-degraded';
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function severityClass(severity) {
    if (severity === 'critical') return 'sev-critical';
    if (severity === 'major') return 'sev-major';
    return 'sev-minor';
  }

  function uptimeColor(pct) {
    if (pct >= 99.5) return 'var(--accent-operational, #4ade80)';
    if (pct >= 95) return 'var(--accent-degraded, #f59e0b)';
    return 'var(--accent-down, #ef4444)';
  }

  async function subscribe() {
    if (!subEmail.trim()) return;
    subscribing = true;
    subError = '';
    subSuccess = false;
    try {
      const res = await fetch('/api/status-page/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id, email: subEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to subscribe');
      subSuccess = true;
      subEmail = '';
    } catch (e) {
      subError = e.message;
    }
    subscribing = false;
  }

  // Sparkline SVG for latency data
  function sparklinePath(points, key, width, height) {
    if (!points || points.length < 2) return '';
    const values = points.map(p => p[key]);
    const max = Math.max(...values) || 1;
    const min = Math.min(...values);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);

    return values.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
</script>

<svelte:head>
  <title>{page.title} — Status | APIdown.net</title>
  <meta name="description" content={page.description || `Live status page for ${page.title}. Real-time monitoring powered by APIdown.net.`} />
  <link rel="canonical" href={`https://apidown.net/status/${page.slug || ''}`} />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={`${page.title} — Status`} />
  <meta property="og:description" content={page.description || `Live status page for ${page.title}.`} />
  <meta property="og:url" content={`https://apidown.net/status/${page.slug || ''}`} />
  {@html `<script type="application/ld+json">${JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": `${page.title} — Status`,
      "description": page.description || `Live status page for ${page.title}`,
      "url": `https://apidown.net/status/${page.slug || ''}`,
      "isPartOf": { "@type": "WebSite", "name": "APIdown.net", "url": "https://apidown.net" },
      "mainEntity": {
        "@type": "ItemList",
        "name": `${page.title} Monitored APIs`,
        "numberOfItems": apis.length,
        "itemListElement": apis.map((api, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "name": api.name,
          "url": `https://apidown.net/api/${api.slug}`
        }))
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://apidown.net" },
        { "@type": "ListItem", "position": 2, "name": page.title, "item": `https://apidown.net/status/${page.slug || ''}` }
      ]
    }
  ])}</script>`}
  <style>
    :root {
      --sp-accent: {page.accentColor};
      --accent-operational: #4ade80;
      --accent-degraded: #f59e0b;
      --accent-down: #ef4444;
    }
  </style>
</svelte:head>

<div class="status-page" style="--sp-accent: {page.accentColor}">
  <!-- Header -->
  <div class="status-header">
    {#if page.logoUrl}
      <img src={page.logoUrl} alt="{page.title} logo" class="page-logo" width="48" height="48" />
    {/if}
    <h1>{page.title}</h1>
    {#if page.description}
      <p class="status-desc">{page.description}</p>
    {/if}
  </div>

  <!-- Overall Banner -->
  <div class="overall-banner {overallClass()}">
    <span class="overall-dot"></span>
    <span>{overallLabel()}</span>
    {#if overallUptime !== null}
      <span class="uptime-pct">{overallUptime}% uptime (30d)</span>
    {/if}
  </div>

  <!-- API List -->
  {#if apis.length > 0}
    <div class="api-list">
      {#each apis as api (api.slug)}
        <div class="api-row">
          <div class="api-row-header">
            <a href="/api/{api.slug}" class="api-link" target="_blank" rel="noopener">
              {#if api.logo_url}
                <img src={api.logo_url} alt="" class="api-logo" loading="lazy" width="24" height="24" />
              {:else}
                <div class="api-logo-placeholder">{api.name.charAt(0)}</div>
              {/if}
              <span class="api-name">{api.name}</span>
            </a>
            <div class="api-status api-status-{api.status}">
              <span class="status-dot status-dot-{api.status}"></span>
              <span>{api.status === 'operational' ? 'Operational' : api.status === 'degraded' ? 'Degraded' : api.status === 'down' ? 'Down' : api.status}</span>
            </div>
          </div>

          <!-- Uptime Bar -->
          {#if page.showUptimeBars && uptimeData[api.id]}
            <div class="uptime-bar-wrap">
              <div class="uptime-bar" title="Daily uptime for the last {uptimeData[api.id].length} days">
                {#each uptimeData[api.id] as day}
                  <div
                    class="uptime-day"
                    style="background: {uptimeColor(day.uptime)}"
                    title="{day.date}: {day.uptime}% uptime"
                  ></div>
                {/each}
              </div>
              <div class="uptime-labels">
                <span>{uptimeData[api.id].length}d ago</span>
                <span>Today</span>
              </div>
            </div>
          {/if}

          <!-- Latency Sparkline -->
          {#if page.showLatencyChart && latencyData[api.id] && latencyData[api.id].length > 1}
            <div class="latency-wrap">
              <svg viewBox="0 0 300 40" class="latency-svg" preserveAspectRatio="none">
                <path d={sparklinePath(latencyData[api.id], 'p50', 300, 40)} fill="none" stroke="var(--sp-accent)" stroke-width="1.5" />
                <path d={sparklinePath(latencyData[api.id], 'p95', 300, 40)} fill="none" stroke="var(--accent-degraded)" stroke-width="1" opacity="0.6" />
              </svg>
              <div class="latency-labels">
                <span class="latency-label"><span class="latency-dot" style="background: var(--sp-accent)"></span> P50</span>
                <span class="latency-label"><span class="latency-dot" style="background: var(--accent-degraded); opacity: 0.6"></span> P95</span>
                <span class="latency-value">Latest: {latencyData[api.id].at(-1)?.p50 ?? '—'}ms</span>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <p class="empty-msg">No APIs are being monitored on this status page.</p>
  {/if}

  <!-- Recent Incidents -->
  {#if page.showIncidents && recentIncidents.length > 0}
    <section class="incidents-section">
      <h2>Recent Incidents</h2>
      <div class="incident-list">
        {#each recentIncidents as inc (inc.id)}
          <div class="incident-card">
            <div class="incident-header">
              <span class="incident-sev {severityClass(inc.severity)}">{inc.severity}</span>
              <span class="incident-title">{inc.title}</span>
              <span class="incident-status incident-status-{inc.status}">{inc.status}</span>
            </div>
            <div class="incident-meta">
              <span class="incident-api">{inc.apiName}</span>
              <span class="incident-time">{formatDate(inc.startedAt)}</span>
              {#if inc.resolvedAt}
                <span class="incident-resolved">Resolved {formatDate(inc.resolvedAt)}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>
  {:else if page.showIncidents}
    <section class="incidents-section">
      <h2>Recent Incidents</h2>
      <p class="no-incidents">No recent incidents. All clear!</p>
    </section>
  {/if}

  <!-- Subscribe Form -->
  {#if page.showSubscriberForm}
    <section class="subscribe-section">
      <h3>Get notified</h3>
      <p class="subscribe-desc">Receive email updates when a monitored service has issues.</p>
      {#if subSuccess}
        <p class="sub-success">Check your email to confirm your subscription.</p>
      {:else}
        <form class="subscribe-form" onsubmit={(e) => { e.preventDefault(); subscribe(); }}>
          <input
            type="email"
            bind:value={subEmail}
            placeholder="you@example.com"
            required
            class="sub-input"
          />
          <button type="submit" class="sub-btn" disabled={subscribing}>
            {subscribing ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>
        {#if subError}
          <p class="sub-error">{subError}</p>
        {/if}
      {/if}
    </section>
  {/if}

  <!-- Powered By -->
  {#if page.showPoweredBy}
    <div class="powered-by">
      <a href="https://apidown.net" target="_blank" rel="noopener">Powered by APIdown.net</a>
    </div>
  {/if}
</div>

<style>
  .status-page {
    max-width: 750px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .status-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .page-logo {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    margin-bottom: 0.75rem;
  }

  .status-header h1 {
    font-size: 1.6rem;
    font-weight: 700;
    margin-bottom: 0.4rem;
  }

  .status-desc {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  /* Overall Banner */
  .overall-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.85rem 1.25rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.95rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .uptime-pct {
    font-size: 0.8rem;
    font-weight: 400;
    opacity: 0.8;
    margin-left: 0.5rem;
  }

  .overall-ok {
    background: rgba(74, 222, 128, 0.12);
    color: var(--accent-operational);
    border: 1px solid rgba(74, 222, 128, 0.25);
  }

  .overall-degraded {
    background: rgba(245, 158, 11, 0.12);
    color: var(--accent-degraded);
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .overall-down {
    background: rgba(239, 68, 68, 0.12);
    color: var(--accent-down);
    border: 1px solid rgba(239, 68, 68, 0.25);
  }

  .overall-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  /* API List */
  .api-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .api-row {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
  }

  .api-row-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .api-link {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    text-decoration: none;
    color: var(--color-text);
  }

  .api-link:hover {
    color: var(--sp-accent);
  }

  .api-logo {
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }

  .api-logo-placeholder {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: var(--sp-accent);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .api-name {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .api-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .api-status-operational { color: var(--accent-operational); }
  .api-status-degraded { color: var(--accent-degraded); }
  .api-status-down { color: var(--accent-down); }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-dot-operational { background: var(--accent-operational); }
  .status-dot-degraded { background: var(--accent-degraded); }
  .status-dot-down { background: var(--accent-down); }

  /* Uptime Bar */
  .uptime-bar-wrap {
    margin-top: 0.75rem;
  }

  .uptime-bar {
    display: flex;
    gap: 1px;
    height: 20px;
    border-radius: 3px;
    overflow: hidden;
  }

  .uptime-day {
    flex: 1;
    min-width: 1px;
    border-radius: 1px;
    transition: opacity 0.15s;
    cursor: default;
  }

  .uptime-day:hover {
    opacity: 0.75;
  }

  .uptime-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    margin-top: 0.25rem;
  }

  /* Latency */
  .latency-wrap {
    margin-top: 0.6rem;
  }

  .latency-svg {
    width: 100%;
    height: 40px;
    display: block;
  }

  .latency-labels {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    margin-top: 0.2rem;
  }

  .latency-label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .latency-dot {
    width: 8px;
    height: 3px;
    border-radius: 1px;
    display: inline-block;
  }

  .latency-value {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }

  /* Incidents */
  .incidents-section {
    margin-top: 2rem;
  }

  .incidents-section h2 {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  .incident-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .incident-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }

  .incident-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .incident-sev {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    letter-spacing: 0.03em;
  }

  .sev-critical {
    background: rgba(239, 68, 68, 0.15);
    color: var(--accent-down);
  }

  .sev-major {
    background: rgba(245, 158, 11, 0.15);
    color: var(--accent-degraded);
  }

  .sev-minor {
    background: rgba(74, 222, 128, 0.15);
    color: var(--accent-operational);
  }

  .incident-title {
    font-weight: 600;
    font-size: 0.85rem;
  }

  .incident-status {
    font-size: 0.7rem;
    font-weight: 600;
    margin-left: auto;
    text-transform: capitalize;
  }

  .incident-status-resolved { color: var(--accent-operational); }
  .incident-status-investigating, .incident-status-identified { color: var(--accent-degraded); }
  .incident-status-monitoring { color: var(--sp-accent); }

  .incident-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-top: 0.4rem;
  }

  .no-incidents {
    color: var(--accent-operational);
    font-size: 0.9rem;
    padding: 1rem;
    text-align: center;
    background: rgba(74, 222, 128, 0.08);
    border-radius: 8px;
    border: 1px solid rgba(74, 222, 128, 0.15);
  }

  /* Subscribe */
  .subscribe-section {
    margin-top: 2rem;
    padding: 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    text-align: center;
  }

  .subscribe-section h3 {
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .subscribe-desc {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    margin-bottom: 0.75rem;
  }

  .subscribe-form {
    display: flex;
    gap: 0.5rem;
    max-width: 400px;
    margin: 0 auto;
  }

  .sub-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.85rem;
  }

  .sub-input:focus {
    outline: none;
    border-color: var(--sp-accent);
    box-shadow: 0 0 0 2px rgba(6, 180, 212, 0.15);
  }

  .sub-btn {
    padding: 0.5rem 1rem;
    background: var(--sp-accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .sub-btn:hover { opacity: 0.9; }
  .sub-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .sub-success {
    color: var(--accent-operational);
    font-size: 0.85rem;
  }

  .sub-error {
    color: var(--accent-down);
    font-size: 0.8rem;
    margin-top: 0.4rem;
  }

  /* Powered By */
  .powered-by {
    text-align: center;
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .powered-by a {
    color: var(--color-text-muted);
    font-size: 0.78rem;
    text-decoration: none;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .powered-by a:hover {
    opacity: 1;
    color: var(--sp-accent);
  }

  .empty-msg {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.9rem;
    padding: 2rem 0;
  }

  @media (max-width: 640px) {
    .status-page {
      padding: 1rem 0.75rem;
    }

    .status-header h1 {
      font-size: 1.3rem;
    }

    .subscribe-form {
      flex-direction: column;
    }

    .incident-meta {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  }
</style>
