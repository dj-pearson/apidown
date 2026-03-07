<script>
  let { data = [], range = '24h', loading = false } = $props();

  const W = 700;
  const H = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Compute summary for screen readers
  let summaryText = $derived.by(() => {
    if (!data.length) return '';
    const avgP50 = Math.round(data.reduce((s, d) => s + (d.p50_ms || 0), 0) / data.length);
    const avgP95 = Math.round(data.reduce((s, d) => s + (d.p95_ms || 0), 0) / data.length);
    const maxP95 = Math.round(Math.max(...data.map(d => d.p95_ms || 0)));
    return `Average P50 latency: ${avgP50}ms. Average P95 latency: ${avgP95}ms. Peak P95: ${maxP95}ms. Based on ${data.length} data points over the last ${range}.`;
  });

  let chart = $derived.by(() => {
    if (!data.length) return null;

    const maxY = Math.max(...data.map(d => Math.max(d.p50_ms || 0, d.p95_ms || 0)), 1);
    const stepX = chartW / Math.max(data.length - 1, 1);

    function toPoints(key) {
      return data.map((d, i) => {
        const x = PAD.left + i * stepX;
        const y = PAD.top + chartH - ((d[key] || 0) / maxY) * chartH;
        return `${x},${y}`;
      }).join(' ');
    }

    // Y-axis labels (5 ticks)
    const yTicks = [];
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxY / 4) * i);
      const y = PAD.top + chartH - (i / 4) * chartH;
      yTicks.push({ val, y });
    }

    // X-axis labels — adapt to range
    const xTicks = [];
    const step = Math.max(1, Math.floor(data.length / 6));
    for (let i = 0; i < data.length; i += step) {
      const x = PAD.left + i * stepX;
      const d = new Date(data[i].bucket);
      let label;
      if (range === '24h') {
        label = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      } else {
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      xTicks.push({ x, label });
    }

    return {
      p50: toPoints('p50_ms'),
      p95: toPoints('p95_ms'),
      yTicks,
      xTicks,
      maxY,
    };
  });
</script>

{#if loading || data === undefined}
  <div class="chart-skeleton">
    <div class="skeleton-bar" style="height: 60%"></div>
    <div class="skeleton-bar" style="height: 80%"></div>
    <div class="skeleton-bar" style="height: 45%"></div>
    <div class="skeleton-bar" style="height: 70%"></div>
    <div class="skeleton-bar" style="height: 55%"></div>
    <div class="skeleton-bar" style="height: 90%"></div>
    <div class="skeleton-bar" style="height: 40%"></div>
  </div>
{:else if chart}
  <div class="chart-container">
    <svg viewBox="0 0 {W} {H}" class="latency-chart" role="img" aria-labelledby="latency-chart-title latency-chart-desc">
      <title id="latency-chart-title">{range} Latency Chart — P50 and P95 Response Times</title>
      <desc id="latency-chart-desc">{summaryText}</desc>
      <!-- Grid lines -->
      {#each chart.yTicks as tick}
        <line x1={PAD.left} y1={tick.y} x2={W - PAD.right} y2={tick.y} stroke="var(--color-border)" stroke-width="0.5" />
        <text x={PAD.left - 8} y={tick.y + 4} text-anchor="end" fill="var(--color-text-muted)" font-size="10">{tick.val}ms</text>
      {/each}

      <!-- X-axis labels -->
      {#each chart.xTicks as tick}
        <text x={tick.x} y={H - 5} text-anchor="middle" fill="var(--color-text-muted)" font-size="10">{tick.label}</text>
      {/each}

      <!-- P95 line -->
      <polyline points={chart.p95} fill="none" stroke="#f97316" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />

      <!-- P50 line -->
      <polyline points={chart.p50} fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <div class="legend">
      <span class="legend-item"><span class="legend-line legend-p50"></span> P50</span>
      <span class="legend-item"><span class="legend-line legend-p95"></span> P95</span>
    </div>
  </div>
{:else}
  <p class="empty">No latency data yet</p>
{/if}

<style>
  .chart-container {
    margin-bottom: 2rem;
  }

  .latency-chart {
    width: 100%;
    height: auto;
    max-height: 200px;
  }

  .legend {
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .legend-line {
    display: inline-block;
    width: 16px;
    height: 2px;
    border-radius: 1px;
  }

  .legend-p50 {
    background: var(--color-primary);
  }

  .legend-p95 {
    background: #f97316;
  }

  .empty {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    text-align: center;
    padding: 2rem 0;
  }

  .chart-skeleton {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 200px;
    padding: 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    margin-bottom: 2rem;
  }

  .skeleton-bar {
    flex: 1;
    background: var(--color-surface-hover);
    border-radius: 2px;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
</style>
