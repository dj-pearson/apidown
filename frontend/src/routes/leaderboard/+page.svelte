<script>
  let { data } = $props();
  let viewMode = $state('all'); // 'all' or category name
  let sortBy = $state('score'); // 'score', 'uptime', 'latency', 'incidents'

  const sortOptions = [
    { value: 'score', label: 'Reliability Score' },
    { value: 'uptime', label: 'Uptime %' },
    { value: 'latency', label: 'Lowest Latency' },
    { value: 'incidents', label: 'Fewest Incidents' },
  ];

  const categoryNames = $derived(['all', ...data.categories.map(c => c.name)]);

  const displayApis = $derived(() => {
    let apis = viewMode === 'all'
      ? [...data.allRanked]
      : data.categories.find(c => c.name === viewMode)?.apis || [];

    if (sortBy === 'uptime') apis.sort((a, b) => Number(b.uptimePct) - Number(a.uptimePct));
    else if (sortBy === 'latency') apis.sort((a, b) => (a.p95Ms || 9999) - (b.p95Ms || 9999));
    else if (sortBy === 'incidents') apis.sort((a, b) => a.incidentCount - b.incidentCount);
    else apis.sort((a, b) => b.score - a.score);

    return apis;
  });
</script>

<svelte:head>
  <title>API Reliability Leaderboard — APIdown.net</title>
  <meta name="description" content="Independent API reliability rankings based on crowd-sourced production monitoring data. Compare uptime, latency, and incident frequency across 40+ APIs." />
  <link rel="canonical" href="https://apidown.net/leaderboard" />
  <meta property="og:title" content="API Reliability Leaderboard" />
  <meta property="og:description" content="See which APIs are most reliable. Independent rankings from real production traffic data." />
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "API Reliability Leaderboard",
    "description": "Independent API reliability rankings based on crowd-sourced production monitoring.",
    "url": "https://apidown.net/leaderboard",
    "isPartOf": { "@type": "WebSite", "name": "APIdown.net", "url": "https://apidown.net" }
  })}</script>`}
</svelte:head>

<div class="leaderboard">
  <div class="lb-header">
    <h1>API Reliability Leaderboard</h1>
    <p class="lb-subtitle">Independent rankings from crowd-sourced production monitoring. Updated every 5 minutes.</p>
  </div>

  <!-- Controls -->
  <div class="lb-controls">
    <div class="lb-categories">
      {#each categoryNames as cat}
        <button
          class="cat-btn"
          class:cat-active={viewMode === cat}
          onclick={() => viewMode = cat}
        >
          {cat === 'all' ? 'All APIs' : cat}
        </button>
      {/each}
    </div>

    <div class="lb-sort">
      <label for="sort-select">Sort by</label>
      <select id="sort-select" bind:value={sortBy}>
        {#each sortOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Ranking Table -->
  <div class="lb-table">
    <div class="lb-table-header">
      <span class="col-rank">#</span>
      <span class="col-api">API</span>
      <span class="col-grade">Grade</span>
      <span class="col-uptime">Uptime (30d)</span>
      <span class="col-latency">P95 Latency</span>
      <span class="col-incidents">Incidents (90d)</span>
    </div>

    {#each displayApis() as api, index (api.id)}
      <a href="/api/{api.slug}/report-card" class="lb-row">
        <span class="col-rank rank-num">{index + 1}</span>
        <span class="col-api api-cell">
          {#if api.logo_url}
            <img src={api.logo_url} alt="" width="20" height="20" class="lb-logo" loading="lazy" />
          {:else}
            <div class="lb-logo-ph">{api.name[0]}</div>
          {/if}
          <span class="lb-api-name">{api.name}</span>
          {#if api.category}
            <span class="lb-cat-tag">{api.category}</span>
          {/if}
        </span>
        <span class="col-grade">
          <span class="grade-pill" style="background: {api.gradeColor}20; color: {api.gradeColor}; border-color: {api.gradeColor}40">
            {api.grade}
          </span>
        </span>
        <span class="col-uptime">{api.uptimePct}%</span>
        <span class="col-latency">{api.p95Ms > 0 ? api.p95Ms + 'ms' : '—'}</span>
        <span class="col-incidents">{api.incidentCount}</span>
      </a>
    {/each}

    {#if displayApis().length === 0}
      <p class="lb-empty">No APIs found for this category.</p>
    {/if}
  </div>

  <div class="lb-footer">
    <p>Scores calculated from: uptime (40%), P95 latency (25%), incident frequency (20%), resolution time (15%). <a href="/docs">Learn more</a></p>
  </div>
</div>

<style>
  .leaderboard {
    max-width: 900px;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }

  .lb-header {
    margin-bottom: 1.5rem;
  }

  .lb-header h1 {
    font-size: 1.6rem;
    font-weight: 700;
    margin-bottom: 0.3rem;
  }

  .lb-subtitle {
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }

  /* Controls */
  .lb-controls {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .lb-categories {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .cat-btn {
    padding: 0.3rem 0.65rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .cat-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .cat-active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }

  .lb-sort {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .lb-sort label {
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }

  .lb-sort select {
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.78rem;
  }

  /* Table */
  .lb-table {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .lb-table-header {
    display: grid;
    grid-template-columns: 40px 1fr 70px 100px 100px 100px;
    padding: 0.6rem 0.75rem;
    background: var(--color-surface);
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--color-border);
  }

  .lb-row {
    display: grid;
    grid-template-columns: 40px 1fr 70px 100px 100px 100px;
    padding: 0.6rem 0.75rem;
    align-items: center;
    text-decoration: none;
    color: var(--color-text);
    border-bottom: 1px solid var(--color-border);
    transition: background 0.1s;
    font-size: 0.85rem;
  }

  .lb-row:last-child { border-bottom: none; }
  .lb-row:hover { background: var(--color-surface); }

  .rank-num {
    font-weight: 700;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .api-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .lb-logo {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .lb-logo-ph {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: var(--color-primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .lb-api-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lb-cat-tag {
    font-size: 0.65rem;
    color: var(--color-text-muted);
    background: var(--color-bg);
    padding: 0.05rem 0.35rem;
    border-radius: 3px;
    flex-shrink: 0;
    display: none;
  }

  .grade-pill {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    border: 1px solid;
  }

  .col-uptime, .col-latency, .col-incidents {
    font-variant-numeric: tabular-nums;
    font-size: 0.82rem;
  }

  .lb-empty {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-muted);
  }

  /* Footer */
  .lb-footer {
    margin-top: 1rem;
    text-align: center;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .lb-footer a { color: var(--color-primary); }

  @media (max-width: 700px) {
    .lb-table-header, .lb-row {
      grid-template-columns: 30px 1fr 55px 75px;
    }

    .col-latency, .col-incidents {
      display: none;
    }

    .lb-cat-tag { display: none; }
  }
</style>
