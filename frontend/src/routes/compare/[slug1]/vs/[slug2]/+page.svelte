<script>
  let { data } = $props();
  const [a, b] = data.comparisons;

  const metrics = [
    { label: 'Reliability Score', key: 'score', aVal: a.score.score, bVal: b.score.score, unit: '/100', higher: true },
    { label: 'Grade', key: 'grade', aVal: a.score.grade, bVal: b.score.grade, unit: '', higher: null },
    { label: 'Uptime (30d)', key: 'uptime', aVal: Number(a.uptimePct), bVal: Number(b.uptimePct), unit: '%', higher: true, fmt: v => v.toFixed(3) },
    { label: 'P50 Latency', key: 'p50', aVal: a.avgP50, bVal: b.avgP50, unit: 'ms', higher: false },
    { label: 'P95 Latency', key: 'p95', aVal: a.metrics.p95Ms, bVal: b.metrics.p95Ms, unit: 'ms', higher: false },
    { label: 'Incidents (90d)', key: 'incidents', aVal: a.incidentCount, bVal: b.incidentCount, unit: '', higher: false },
    { label: 'Avg Resolution', key: 'resolution', aVal: a.metrics.avgResolutionMin, bVal: b.metrics.avgResolutionMin, unit: 'min', higher: false },
    { label: 'Regions', key: 'regions', aVal: a.regions.length, bVal: b.regions.length, unit: '', higher: true },
  ];

  function winner(metric) {
    if (metric.higher === null) return 'tie';
    if (metric.aVal === metric.bVal) return 'tie';
    if (metric.higher) return metric.aVal > metric.bVal ? 'a' : 'b';
    return metric.aVal < metric.bVal ? 'a' : 'b';
  }

  function fmt(metric, val) {
    if (metric.fmt) return metric.fmt(val);
    return val;
  }

  const aWins = metrics.filter(m => winner(m) === 'a').length;
  const bWins = metrics.filter(m => winner(m) === 'b').length;
  const overallWinner = aWins > bWins ? 'a' : bWins > aWins ? 'b' : 'tie';
</script>

<svelte:head>
  <title>{a.api.name} vs {b.api.name} — API Reliability Comparison — APIdown.net</title>
  <meta name="description" content="Compare {a.api.name} vs {b.api.name} reliability: uptime, latency, incidents, and more. Independent data from APIdown.net." />
  <link rel="canonical" href="https://apidown.net/compare/{a.api.slug}/vs/{b.api.slug}" />
  <meta property="og:title" content="{a.api.name} vs {b.api.name} Reliability" />
  <meta property="og:description" content="Head-to-head API reliability comparison. {a.api.name}: {a.score.grade} ({a.uptimePct}% uptime) vs {b.api.name}: {b.score.grade} ({b.uptimePct}% uptime)" />
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `${a.api.name} vs ${b.api.name} — Reliability Comparison`,
    "url": `https://apidown.net/compare/${a.api.slug}/vs/${b.api.slug}`,
    "isPartOf": { "@type": "WebSite", "name": "APIdown.net", "url": "https://apidown.net" }
  })}</script>`}
</svelte:head>

<div class="comparison">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> <span>/</span>
    <a href="/leaderboard">Leaderboard</a> <span>/</span>
    <span>{a.api.name} vs {b.api.name}</span>
  </nav>

  <h1>{a.api.name} <span class="vs-label">vs</span> {b.api.name}</h1>
  <p class="comp-subtitle">Head-to-head API reliability comparison based on real production monitoring data.</p>

  <!-- Grade Heroes -->
  <div class="heroes">
    <div class="hero-card" class:hero-winner={overallWinner === 'a'}>
      {#if a.api.logo_url}<img src={a.api.logo_url} alt="" width="32" height="32" class="hero-logo" />{/if}
      <span class="hero-name">{a.api.name}</span>
      <span class="hero-grade" style="color: {a.score.gradeColor}">{a.score.grade}</span>
      <span class="hero-score">{a.score.score}/100</span>
    </div>

    <div class="vs-circle">VS</div>

    <div class="hero-card" class:hero-winner={overallWinner === 'b'}>
      {#if b.api.logo_url}<img src={b.api.logo_url} alt="" width="32" height="32" class="hero-logo" />{/if}
      <span class="hero-name">{b.api.name}</span>
      <span class="hero-grade" style="color: {b.score.gradeColor}">{b.score.grade}</span>
      <span class="hero-score">{b.score.score}/100</span>
    </div>
  </div>

  <!-- Metric Rows -->
  <div class="metric-table">
    {#each metrics as m}
      {@const w = winner(m)}
      <div class="metric-row">
        <span class="mv mv-a" class:mv-win={w === 'a'} class:mv-lose={w === 'b'}>
          {m.key === 'grade' ? a.score.grade : fmt(m, m.aVal)}{m.key !== 'grade' ? m.unit : ''}
        </span>
        <span class="ml">{m.label}</span>
        <span class="mv mv-b" class:mv-win={w === 'b'} class:mv-lose={w === 'a'}>
          {m.key === 'grade' ? b.score.grade : fmt(m, m.bVal)}{m.key !== 'grade' ? m.unit : ''}
        </span>
      </div>
    {/each}
  </div>

  <!-- Severity Breakdown -->
  <div class="sev-section">
    <h2>Incident Severity (90 days)</h2>
    <div class="sev-grid">
      <div class="sev-col">
        <strong>{a.api.name}</strong>
        <span class="sev-item sev-crit">{a.sevCounts.critical} critical</span>
        <span class="sev-item sev-maj">{a.sevCounts.major} major</span>
        <span class="sev-item sev-min">{a.sevCounts.minor} minor</span>
      </div>
      <div class="sev-col">
        <strong>{b.api.name}</strong>
        <span class="sev-item sev-crit">{b.sevCounts.critical} critical</span>
        <span class="sev-item sev-maj">{b.sevCounts.major} major</span>
        <span class="sev-item sev-min">{b.sevCounts.minor} minor</span>
      </div>
    </div>
  </div>

  <!-- Links -->
  <div class="comp-links">
    <a href="/api/{a.api.slug}/report-card">{a.api.name} Full Report</a>
    <a href="/api/{b.api.slug}/report-card">{b.api.name} Full Report</a>
    <a href="/leaderboard">Back to Leaderboard</a>
  </div>

  <div class="comp-footer">
    <p>Data from crowd-sourced production monitoring via <a href="https://apidown.net">APIdown.net</a>.</p>
  </div>
</div>

<style>
  .comparison {
    max-width: 750px;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }

  .breadcrumb { font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 1.5rem; }
  .breadcrumb a { color: var(--color-text-muted); text-decoration: none; }
  .breadcrumb a:hover { color: var(--color-primary); }
  .breadcrumb span { margin: 0 0.3rem; }

  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.3rem; }
  .vs-label { font-weight: 400; color: var(--color-text-muted); font-size: 1rem; }
  .comp-subtitle { font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 1.5rem; }

  /* Heroes */
  .heroes {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .hero-card {
    flex: 1;
    text-align: center;
    padding: 1.25rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .hero-winner {
    border-color: var(--color-operational);
    box-shadow: 0 0 12px rgba(74, 222, 128, 0.15);
  }

  .hero-logo { width: 32px; height: 32px; border-radius: 6px; }
  .hero-name { font-weight: 700; font-size: 1rem; }
  .hero-grade { font-size: 2rem; font-weight: 800; line-height: 1; }
  .hero-score { font-size: 0.75rem; color: var(--color-text-muted); }

  .vs-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  /* Metric Table */
  .metric-table {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 2rem;
  }

  .metric-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid var(--color-border);
    align-items: center;
    font-size: 0.85rem;
  }

  .metric-row:last-child { border-bottom: none; }

  .mv { font-weight: 600; font-variant-numeric: tabular-nums; }
  .mv-a { text-align: right; padding-right: 1rem; }
  .mv-b { text-align: left; padding-left: 1rem; }
  .mv-win { color: var(--color-operational); }
  .mv-lose { color: var(--color-text-muted); opacity: 0.7; }

  .ml {
    text-align: center;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    font-weight: 500;
    white-space: nowrap;
  }

  /* Severity */
  .sev-section { margin-bottom: 2rem; }
  .sev-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; }

  .sev-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .sev-col {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.75rem;
  }

  .sev-col strong { font-size: 0.85rem; margin-bottom: 0.25rem; }
  .sev-item { font-size: 0.8rem; }
  .sev-crit { color: var(--color-down); }
  .sev-maj { color: var(--color-degraded); }
  .sev-min { color: var(--color-operational); }

  /* Links */
  .comp-links {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .comp-links a {
    font-size: 0.85rem;
    color: var(--color-primary);
    text-decoration: none;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--color-primary);
    border-radius: 6px;
  }

  .comp-links a:hover { background: rgba(6, 180, 212, 0.1); }

  .comp-footer { text-align: center; font-size: 0.8rem; color: var(--color-text-muted); border-top: 1px solid var(--color-border); padding-top: 1rem; }
  .comp-footer a { color: var(--color-primary); }

  @media (max-width: 600px) {
    .heroes { flex-direction: column; }
    .vs-circle { width: 30px; height: 30px; font-size: 0.7rem; }
  }
</style>
