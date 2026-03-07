<script>
  let { data = [], width = 80, height = 24, apiName = 'API' } = $props();

  let sparkSummary = $derived(
    data.length > 1
      ? `${apiName} latency trend: min ${Math.round(Math.min(...data))}ms, max ${Math.round(Math.max(...data))}ms, latest ${Math.round(data[data.length - 1])}ms`
      : `${apiName}: no latency data available`
  );

  let points = $derived.by(() => {
    if (!data.length) return '';
    const max = Math.max(...data, 1);
    const step = width / Math.max(data.length - 1, 1);
    return data.map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * (height - 2) - 1;
      return `${x},${y}`;
    }).join(' ');
  });
</script>

<svg {width} {height} class="sparkline" viewBox="0 0 {width} {height}" role="img" aria-labelledby="sparkline-title-{apiName}">
  <title id="sparkline-title-{apiName}">{sparkSummary}</title>
  {#if data.length > 1}
    <polyline
      points={points}
      fill="none"
      stroke="var(--color-primary)"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {:else}
    <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--color-border)" stroke-width="1" />
  {/if}
</svg>

<style>
  .sparkline {
    display: block;
    flex-shrink: 0;
  }
</style>
