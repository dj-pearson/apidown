<script>
  let { data = [] } = $props();
  let tooltip = $state(null);

  function barColor(uptime) {
    if (uptime >= 99.5) return 'var(--color-operational)';
    if (uptime >= 95) return 'var(--color-degraded)';
    return 'var(--color-down)';
  }

  function showTooltip(day, e) {
    const rect = e.target.getBoundingClientRect();
    tooltip = {
      date: day.date,
      uptime: day.uptime,
      x: rect.left + rect.width / 2,
      y: rect.top,
    };
  }

  function hideTooltip() {
    tooltip = null;
  }
</script>

{#if data === undefined}
  <section class="uptime-section">
    <div class="uptime-header">
      <h2>90-Day Uptime</h2>
    </div>
    <div class="uptime-bar skeleton-bar-container">
      {#each { length: 90 } as _}
        <div class="bar-segment skeleton-segment"></div>
      {/each}
    </div>
    <div class="uptime-labels">
      <span>90 days ago</span>
      <span>Today</span>
    </div>
  </section>
{:else if data.length > 0}
  <section class="uptime-section">
    <div class="uptime-header">
      <h2>90-Day Uptime</h2>
      <span class="uptime-pct">{data.every(d => d.uptime >= 99.5) ? '100%' : ''}</span>
    </div>
    <div class="uptime-bar" role="img" aria-label="90-day uptime history showing daily uptime percentages">
      {#each data as day, i}
        <div
          class="bar-segment"
          style="background: {barColor(day.uptime)}"
          onmouseenter={(e) => showTooltip(day, e)}
          onmouseleave={hideTooltip}
          onfocus={(e) => showTooltip(day, e)}
          onblur={hideTooltip}
          onkeydown={(e) => {
            if (e.key === 'ArrowRight' && e.target.nextElementSibling) e.target.nextElementSibling.focus();
            if (e.key === 'ArrowLeft' && e.target.previousElementSibling) e.target.previousElementSibling.focus();
          }}
          tabindex="0"
          role="button"
          aria-label="{day.date}: {day.uptime}% uptime"
        ></div>
      {/each}
    </div>
    <div class="uptime-labels">
      <span>90 days ago</span>
      <span>Today</span>
    </div>
    {#if tooltip}
      <div class="uptime-tooltip" style="left: {tooltip.x}px; top: {tooltip.y}px;" aria-live="polite">
        <strong>{tooltip.date}</strong>
        <span>{tooltip.uptime}% uptime</span>
      </div>
    {/if}
  </section>
{/if}

<style>
  .uptime-section {
    margin-bottom: 2rem;
    position: relative;
  }

  .uptime-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .uptime-header h2 {
    font-size: 1.1rem;
  }

  .uptime-pct {
    font-size: 0.85rem;
    color: var(--color-operational);
    font-weight: 600;
  }

  .uptime-bar {
    display: flex;
    gap: 1px;
    height: 32px;
    border-radius: 4px;
    overflow: hidden;
  }

  .bar-segment {
    flex: 1;
    min-width: 2px;
    cursor: pointer;
    transition: opacity 0.1s;
  }

  .bar-segment:hover {
    opacity: 0.7;
  }

  .uptime-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    margin-top: 0.25rem;
  }

  .skeleton-segment {
    background: var(--color-surface-hover) !important;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }

  .uptime-tooltip {
    position: fixed;
    transform: translate(-50%, -100%);
    margin-top: -8px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    pointer-events: none;
    z-index: 100;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
</style>
