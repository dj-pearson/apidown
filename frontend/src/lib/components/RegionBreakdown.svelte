<script>
  let { data = [], loading = false } = $props();

  // Aggregate by region from the last 1 hour of data
  let regions = $derived.by(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = data.filter(d => d.bucket >= oneHourAgo);

    const map = {};
    for (const row of recent) {
      const r = row.region || 'unknown';
      if (!map[r]) map[r] = { signals: 0, errors: 0, totalLatency: 0 };
      map[r].signals += row.total_signals;
      map[r].errors += row.error_count;
      map[r].totalLatency += row.avg_duration_ms * row.total_signals;
    }

    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        signals: d.signals,
        errorRate: d.signals > 0 ? (d.errors / d.signals) * 100 : 0,
        avgLatency: d.signals > 0 ? Math.round(d.totalLatency / d.signals) : 0,
      }))
      .sort((a, b) => b.signals - a.signals);
  });

  function statusColor(errorRate) {
    if (errorRate > 20) return 'var(--color-down)';
    if (errorRate > 5) return 'var(--color-degraded)';
    return 'var(--color-operational)';
  }

  function statusLabel(errorRate) {
    if (errorRate > 20) return 'Down';
    if (errorRate > 5) return 'Degraded';
    return 'Healthy';
  }
</script>

{#if loading || data === undefined}
  <section class="region-breakdown">
    <h2>Regional Status</h2>
    <div class="region-grid">
      {#each { length: 4 } as _}
        <div class="region-card skeleton-card">
          <div class="skeleton-line" style="width: 60%"></div>
          <div class="skeleton-line" style="width: 80%; margin-top: 0.5rem"></div>
          <div class="skeleton-line" style="width: 50%; margin-top: 0.25rem"></div>
        </div>
      {/each}
    </div>
  </section>
{:else if regions.length > 0}
  <section class="region-breakdown" aria-label="Regional status breakdown">
    <h2>Regional Status</h2>
    <span class="sr-only">
      {regions.length} regions reporting. {regions.filter(r => r.errorRate <= 5).length} healthy, {regions.filter(r => r.errorRate > 5 && r.errorRate <= 20).length} degraded, {regions.filter(r => r.errorRate > 20).length} down.
    </span>
    <div class="region-grid">
      {#each regions as region}
        <div class="region-card">
          <div class="region-header">
            <span class="region-dot" style="background: {statusColor(region.errorRate)}" aria-hidden="true"></span>
            <span class="region-name">{region.name}</span>
            <span class="region-status-label" style="color: {statusColor(region.errorRate)}">{statusLabel(region.errorRate)}</span>
          </div>
          <div class="region-stats">
            <span>{region.signals} signals</span>
            <span>{region.errorRate.toFixed(1)}% errors</span>
            <span>{region.avgLatency}ms avg</span>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .region-breakdown {
    margin-bottom: 2rem;
  }

  .region-breakdown h2 {
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }

  .region-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .region-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.75rem;
  }

  .region-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.4rem;
  }

  .region-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .region-name {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--color-text);
  }

  .region-status-label {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .region-stats {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .skeleton-card {
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  .skeleton-line {
    height: 12px;
    background: var(--color-surface-hover);
    border-radius: 4px;
  }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
</style>
