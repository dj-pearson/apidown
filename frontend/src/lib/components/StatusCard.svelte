<script>
  import Sparkline from './Sparkline.svelte';

  let { api, sparkline = [] } = $props();
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

<a href="/api/{api.slug}" class="card">
  <div class="card-header">
    {#if api.logo_url && !logoFailed}
      <img src={api.logo_url} alt="{api.name} logo" class="logo" loading="lazy" width="24" height="24" onerror={() => logoFailed = true} />
    {:else}
      <div class="logo-placeholder">{api.name[0]}</div>
    {/if}
    <span class="name">{api.name}</span>
    <div class="sparkline-wrap">
      <Sparkline data={sparkline} apiName={api.name} />
    </div>
  </div>
  <div class="card-status">
    <span class="dot" style="background: {dotColor}"></span>
    <span class="label" style="color: {dotColor}">{label}</span>
  </div>
</a>

<style>
  .card {
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
</style>
