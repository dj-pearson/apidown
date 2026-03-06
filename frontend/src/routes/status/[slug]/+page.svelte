<script>
  let { data } = $props();

  const allOperational = $derived(
    data.apis.length > 0 && data.apis.every(a => a.status === 'operational')
  );
  const hasDown = $derived(data.apis.some(a => a.status === 'down'));
  const hasDegraded = $derived(data.apis.some(a => a.status === 'degraded'));

  function overallLabel() {
    if (data.apis.length === 0) return 'No APIs monitored';
    if (allOperational) return 'All Systems Operational';
    if (hasDown) return 'Some Systems Experiencing Issues';
    if (hasDegraded) return 'Some Systems Degraded';
    return 'Partial Issues Detected';
  }

  function overallClass() {
    if (allOperational) return 'overall-ok';
    if (hasDown) return 'overall-down';
    return 'overall-degraded';
  }
</script>

<svelte:head>
  <title>{data.title} - Status</title>
  {#if data.description}
    <meta name="description" content={data.description} />
  {/if}
</svelte:head>

<div class="status-page">
  <div class="status-header">
    <h1>{data.title}</h1>
    {#if data.description}
      <p class="status-desc">{data.description}</p>
    {/if}
  </div>

  <div class="overall-banner {overallClass()}">
    <span class="overall-dot"></span>
    <span>{overallLabel()}</span>
  </div>

  {#if data.apis.length > 0}
    <div class="api-grid">
      {#each data.apis as api (api.slug)}
        <a href="/api/{api.slug}" class="api-card" target="_blank" rel="noopener">
          <div class="api-card-header">
            {#if api.logo_url}
              <img src={api.logo_url} alt="" class="api-logo" />
            {:else}
              <div class="api-logo-placeholder">{api.name.charAt(0)}</div>
            {/if}
            <span class="api-name">{api.name}</span>
          </div>
          <div class="api-status api-status-{api.status}">
            <span class="status-dot status-dot-{api.status}"></span>
            <span>{api.status === 'operational' ? 'Operational' : api.status === 'degraded' ? 'Degraded' : api.status === 'down' ? 'Down' : api.status}</span>
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <p class="empty-msg">No APIs are being monitored on this status page.</p>
  {/if}

  <div class="powered-by">
    <a href="https://apidown.net" target="_blank" rel="noopener">Powered by APIdown.net</a>
  </div>
</div>

<style>
  .status-page {
    max-width: 700px;
    margin: 0 auto;
    padding: 2rem 0;
  }

  .status-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .status-header h1 {
    font-size: 1.6rem;
    font-weight: 700;
    margin-bottom: 0.4rem;
  }

  .status-desc {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .overall-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.85rem 1.25rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.95rem;
    margin-bottom: 1.5rem;
  }

  .overall-ok {
    background: rgba(74, 222, 128, 0.12);
    color: var(--color-operational, #4ade80);
    border: 1px solid rgba(74, 222, 128, 0.25);
  }

  .overall-degraded {
    background: rgba(245, 158, 11, 0.12);
    color: var(--color-degraded, #f59e0b);
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .overall-down {
    background: rgba(239, 68, 68, 0.12);
    color: var(--color-down, #ef4444);
    border: 1px solid rgba(239, 68, 68, 0.25);
  }

  .overall-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .api-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .api-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    text-decoration: none;
    color: var(--color-text);
    transition: border-color 0.15s;
  }

  .api-card:hover {
    border-color: var(--color-primary);
    text-decoration: none;
  }

  .api-card-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .api-logo {
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }

  .api-logo-placeholder {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: var(--color-primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .api-name {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .api-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .api-status-operational { color: var(--color-operational, #4ade80); }
  .api-status-degraded { color: var(--color-degraded, #f59e0b); }
  .api-status-down { color: var(--color-down, #ef4444); }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-dot-operational { background: var(--color-operational, #4ade80); }
  .status-dot-degraded { background: var(--color-degraded, #f59e0b); }
  .status-dot-down { background: var(--color-down, #ef4444); }

  .empty-msg {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.9rem;
    padding: 2rem 0;
  }

  .powered-by {
    text-align: center;
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .powered-by a {
    color: var(--color-text-muted);
    font-size: 0.78rem;
    text-decoration: none;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .powered-by a:hover {
    opacity: 1;
    color: var(--color-primary);
  }

  @media (max-width: 640px) {
    .status-page {
      padding: 1rem 0;
    }

    .status-header h1 {
      font-size: 1.3rem;
    }
  }
</style>
