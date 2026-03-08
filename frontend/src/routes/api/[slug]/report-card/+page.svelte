<script>
  let { data } = $props();
  const { api, score, metrics, trend, scoreDelta, incidents, peers } = data;

  const trendIcon = trend === 'improving' ? '↑' : trend === 'degrading' ? '↓' : '→';
  const trendColor = trend === 'improving' ? 'var(--color-operational)' : trend === 'degrading' ? 'var(--color-down)' : 'var(--color-text-muted)';

  function metricLabel(key) {
    return { uptime: 'Uptime (30d)', latency: 'P95 Latency', incidents: 'Incidents (90d)', resolution: 'Avg Resolution' }[key] || key;
  }

  function metricValue(key, value) {
    if (key === 'uptime') return value.toFixed(3) + '%';
    if (key === 'latency') return value > 0 ? value + 'ms' : 'No data';
    if (key === 'incidents') return value + ' incidents';
    if (key === 'resolution') return value > 0 ? value + ' min' : 'N/A';
    return value;
  }

  function barWidth(s) {
    return Math.max(4, Math.min(100, s)) + '%';
  }

  function barColor(s) {
    if (s >= 80) return 'var(--color-operational)';
    if (s >= 60) return 'var(--color-degraded)';
    return 'var(--color-down)';
  }

  function severityBadge(sev) {
    if (sev === 'critical') return 'sev-critical';
    if (sev === 'major') return 'sev-major';
    return 'sev-minor';
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>{api.name} Reliability Report Card — APIdown.net</title>
  <meta name="description" content="{api.name} reliability score: {score.grade} ({score.score}/100). 30-day uptime: {metrics.uptimePct}%. Independent data from APIdown.net." />
  <link rel="canonical" href="https://apidown.net/api/{api.slug}/report-card" />
  <meta property="og:title" content="{api.name} Reliability: {score.grade}" />
  <meta property="og:description" content="Independent reliability report card for {api.name}. Score: {score.score}/100, Uptime: {metrics.uptimePct}%, P95: {metrics.p95Ms}ms" />
  <meta property="og:url" content="https://apidown.net/api/{api.slug}/report-card" />
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": { "@type": "WebAPI", "name": api.name, "url": `https://apidown.net/api/${api.slug}` },
    "reviewRating": { "@type": "Rating", "ratingValue": score.score, "bestRating": 100, "worstRating": 0 },
    "author": { "@type": "Organization", "name": "APIdown.net" },
    "reviewBody": `${api.name} reliability score: ${score.grade} (${score.score}/100). Based on crowd-sourced production monitoring data.`
  })}</script>`}
</svelte:head>

<div class="report-card">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> <span>/</span>
    <a href="/api/{api.slug}">{api.name}</a> <span>/</span>
    <span>Report Card</span>
  </nav>

  <!-- Hero Grade -->
  <div class="grade-hero">
    <div class="grade-circle" style="border-color: {score.gradeColor}">
      <span class="grade-letter" style="color: {score.gradeColor}">{score.grade}</span>
      <span class="grade-score">{score.score}/100</span>
    </div>
    <div class="grade-info">
      <h1>{api.name} <span class="report-label">Reliability Report Card</span></h1>
      <div class="trend-badge" style="color: {trendColor}">
        <span class="trend-icon">{trendIcon}</span>
        <span>{trend === 'improving' ? 'Improving' : trend === 'degrading' ? 'Degrading' : 'Stable'}</span>
        <span class="trend-delta">({scoreDelta > 0 ? '+' : ''}{scoreDelta} pts vs prior 90d)</span>
      </div>
      <p class="grade-subtitle">Based on crowd-sourced production monitoring data from real developer traffic.</p>
    </div>
  </div>

  <!-- Metric Breakdown -->
  <section class="breakdown-section">
    <h2>Score Breakdown</h2>
    <div class="breakdown-grid">
      {#each Object.entries(score.breakdown) as [key, data]}
        <div class="breakdown-row">
          <div class="breakdown-label">
            <span class="breakdown-name">{metricLabel(key)}</span>
            <span class="breakdown-weight">{data.weight}%</span>
          </div>
          <div class="breakdown-bar-wrap">
            <div class="breakdown-bar" style="width: {barWidth(data.score)}; background: {barColor(data.score)}"></div>
          </div>
          <div class="breakdown-values">
            <span class="breakdown-score">{data.score}/100</span>
            <span class="breakdown-value">{metricValue(key, data.value)}</span>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Recent Incidents -->
  {#if incidents.length > 0}
    <section class="incidents-section">
      <h2>Recent Incidents (90d)</h2>
      <div class="incident-table">
        {#each incidents as inc}
          <div class="incident-row">
            <span class="inc-sev {severityBadge(inc.severity)}">{inc.severity}</span>
            <span class="inc-title">{inc.title}</span>
            <span class="inc-date">{formatDate(inc.started_at)}</span>
            <span class="inc-status inc-status-{inc.status}">{inc.status}</span>
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <section class="incidents-section">
      <h2>Recent Incidents (90d)</h2>
      <p class="no-incidents">No incidents in the last 90 days.</p>
    </section>
  {/if}

  <!-- Category Peers -->
  {#if peers.length > 0}
    <section class="peers-section">
      <h2>Compare with {api.category} Peers</h2>
      <p class="peers-subtitle">See how {api.name} stacks up against other APIs in the same category.</p>
      <div class="peers-grid">
        {#each peers as peer}
          <a href="/api/{peer.slug}/report-card" class="peer-card">
            {#if peer.logo_url}
              <img src={peer.logo_url} alt="" width="20" height="20" class="peer-logo" />
            {/if}
            <span class="peer-name">{peer.name}</span>
            <span class="peer-status peer-status-{peer.current_status}">
              {peer.current_status === 'operational' ? 'Up' : peer.current_status === 'degraded' ? 'Degraded' : 'Down'}
            </span>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <div class="report-footer">
    <p>Data sourced from crowd-sourced production monitoring via <a href="https://apidown.net">APIdown.net</a>. Scores update daily.</p>
  </div>
</div>

<style>
  .report-card {
    max-width: 780px;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }

  .breadcrumb {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 1.5rem;
  }

  .breadcrumb a {
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .breadcrumb a:hover { color: var(--color-primary); }

  .breadcrumb span { margin: 0 0.3rem; }

  /* Hero */
  .grade-hero {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .grade-circle {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    border: 4px solid;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--color-surface);
  }

  .grade-letter {
    font-size: 2.2rem;
    font-weight: 800;
    line-height: 1;
  }

  .grade-score {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-top: 0.15rem;
  }

  .grade-info h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.3rem;
  }

  .report-label {
    font-weight: 400;
    font-size: 0.9rem;
    color: var(--color-text-muted);
    display: block;
  }

  .trend-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .trend-icon { font-size: 1rem; }

  .trend-delta {
    font-weight: 400;
    font-size: 0.78rem;
    opacity: 0.7;
  }

  .grade-subtitle {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  /* Breakdown */
  .breakdown-section {
    margin-bottom: 2rem;
  }

  .breakdown-section h2 {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .breakdown-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .breakdown-row {
    display: grid;
    grid-template-columns: 160px 1fr 120px;
    align-items: center;
    gap: 0.75rem;
  }

  .breakdown-label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .breakdown-name {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .breakdown-weight {
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }

  .breakdown-bar-wrap {
    height: 10px;
    background: var(--color-border);
    border-radius: 5px;
    overflow: hidden;
  }

  .breakdown-bar {
    height: 100%;
    border-radius: 5px;
    transition: width 0.3s ease;
  }

  .breakdown-values {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
  }

  .breakdown-score { font-weight: 600; }
  .breakdown-value { color: var(--color-text-muted); }

  /* Incidents */
  .incidents-section {
    margin-bottom: 2rem;
  }

  .incidents-section h2 {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  .incident-table {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .incident-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 0.8rem;
  }

  .inc-sev {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .sev-critical { background: rgba(239, 68, 68, 0.15); color: var(--color-down); }
  .sev-major { background: rgba(245, 158, 11, 0.15); color: var(--color-degraded); }
  .sev-minor { background: rgba(74, 222, 128, 0.15); color: var(--color-operational); }

  .inc-title { flex: 1; font-weight: 500; }
  .inc-date { color: var(--color-text-muted); flex-shrink: 0; }
  .inc-status { font-weight: 600; text-transform: capitalize; flex-shrink: 0; }
  .inc-status-resolved { color: var(--color-operational); }
  .inc-status-investigating, .inc-status-identified { color: var(--color-degraded); }

  .no-incidents {
    color: var(--color-operational);
    font-size: 0.9rem;
    padding: 1rem;
    text-align: center;
    background: rgba(74, 222, 128, 0.08);
    border-radius: 8px;
  }

  /* Peers */
  .peers-section {
    margin-bottom: 2rem;
  }

  .peers-section h2 {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .peers-subtitle {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    margin-bottom: 0.75rem;
  }

  .peers-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .peer-card {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    text-decoration: none;
    color: var(--color-text);
    font-size: 0.85rem;
    transition: border-color 0.15s;
  }

  .peer-card:hover { border-color: var(--color-primary); }
  .peer-logo { width: 20px; height: 20px; border-radius: 3px; }
  .peer-name { font-weight: 500; }
  .peer-status { font-size: 0.7rem; font-weight: 600; }
  .peer-status-operational { color: var(--color-operational); }
  .peer-status-degraded { color: var(--color-degraded); }
  .peer-status-down { color: var(--color-down); }

  /* Footer */
  .report-footer {
    text-align: center;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .report-footer a { color: var(--color-primary); }

  @media (max-width: 640px) {
    .grade-hero {
      flex-direction: column;
      text-align: center;
    }

    .breakdown-row {
      grid-template-columns: 1fr;
      gap: 0.25rem;
    }

    .breakdown-values {
      gap: 0.5rem;
    }

    .incident-row {
      flex-wrap: wrap;
    }
  }
</style>
