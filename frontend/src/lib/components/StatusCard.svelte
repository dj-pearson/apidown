<script>
  import Sparkline from './Sparkline.svelte';

  let { api, sparkline = [], grade = null, gradeColor = null } = $props();
  let logoFailed = $state(false);

  const statusColors = {
    operational: 'var(--color-operational)',
    degraded: 'var(--color-degraded)',
    down: 'var(--color-down)',
  };

  const statusLabels = {
    operational: 'Operational',
    degraded: 'Degraded',
    down: 'Down',
  };

  let dotColor = $derived(statusColors[api.current_status] || statusColors.operational);
  let label = $derived(statusLabels[api.current_status] || 'Operational');
</script>

<!--
  The whole card is clickable, but it is a <div>, not an <a>: the grade badge is
  its own link and an <a> inside an <a> is invalid HTML. The browser's parser
  silently un-nests it, which changes the DOM out from under hydration. Instead
  the API-name link is stretched over the card with ::after, and the badge sits
  above that overlay — one clickable surface, two real links, valid markup.
-->
<div class="card">
  <div class="card-header">
    {#if api.logo_url && !logoFailed}
      <img src={api.logo_url} alt="" class="logo" loading="lazy" width="24" height="24" onerror={() => logoFailed = true} />
    {:else}
      <div class="logo-placeholder" aria-hidden="true">{api.name[0]}</div>
    {/if}
    <a href="/api/{api.slug}" class="name card-link">
      {api.name}<span class="sr-only"> — {label}</span>
    </a>
    <div class="sparkline-wrap">
      <Sparkline data={sparkline} apiName={api.name} />
    </div>
  </div>
  <div class="card-status">
    <span class="dot" style="background: {dotColor}"></span>
    <span class="label" style="color: {dotColor}">{label}</span>
    {#if grade}
      <a
        href="/api/{api.slug}/report-card"
        class="grade-badge"
        style="background: {gradeColor}20; color: {gradeColor}; border-color: {gradeColor}40"
        aria-label="Reliability grade {grade} — view the {api.name} report card"
      >
        {grade}
      </a>
    {/if}
  </div>
</div>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1rem;
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s;
    min-height: 90px;
  }

  .card:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-primary);
    text-decoration: none;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .logo {
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }

  .logo-placeholder {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .name {
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.95rem;
    flex: 1;
    text-decoration: none;
  }

  /* Stretched link: the API-name anchor covers the whole card. */
  .card-link::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  /* Focus lands on the stretched link, so ring the whole card. */
  .card-link:focus-visible {
    outline: none;
  }

  .card-link:focus-visible::after {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .sparkline-wrap {
    margin-left: auto;
  }

  .card-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .label {
    font-size: 0.8rem;
    font-weight: 500;
  }

  .grade-badge {
    /* Above the stretched link so the badge keeps its own destination. */
    position: relative;
    z-index: 1;
    margin-left: auto;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    border: 1px solid;
    text-decoration: none;
    line-height: 1.2;
    transition: opacity 0.15s;
  }

  .grade-badge:hover,
  .grade-badge:focus-visible {
    opacity: 0.8;
  }
</style>
