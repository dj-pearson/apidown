<script>
  let { data = [] } = $props();

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
</script>

{#if regions.length > 0}
  <section class="region-breakdown">
    <h2>Regional Status</h2>
    <div class="region-grid">
      {#each regions as region}
        <div class="region-card">
          <div class="region-header">
            <span class="region-dot" style="background: {statusColor(region.errorRate)}"></span>
            <span class="region-name">{region.name}</span>
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

  .region-stats {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>
