<script>
  let { data } = $props();
  let incidents = $state(data.incidents);

  function formatDate(iso) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  }
</script>

<svelte:head>
  <title>API Incidents — APIdown.net</title>
  <meta name="description" content="Active and recent API incidents detected from real production traffic." />
</svelte:head>

<h1>Incidents</h1>
<p class="subtitle">Active and recent incidents across all monitored APIs</p>

{#if incidents.length === 0}
  <div class="empty-state">
    <p>No incidents recorded yet. All systems operational.</p>
  </div>
{:else}
  <div class="incidents-list">
    {#each incidents as incident (incident.id)}
      <a href="/incidents/{incident.id}" class="incident-card">
        <div class="incident-header">
          <span class="severity severity-{incident.severity}">{incident.severity}</span>
          <span class="api-name">{incident.apis?.name || 'Unknown'}</span>
          <span class="incident-status status-{incident.status}">{incident.status}</span>
        </div>
        <h3>{incident.title}</h3>
        <div class="incident-footer">
          <span>Started {formatDate(incident.started_at)}</span>
          {#if incident.resolved_at}
            <span>· Resolved {formatDate(incident.resolved_at)}</span>
          {/if}
          {#if incident.report_count > 0}
            <span>· {incident.report_count} report{incident.report_count !== 1 ? 's' : ''}</span>
          {/if}
          {#if incident.regions?.length > 0}
            <span>· Regions: {incident.regions.join(', ')}</span>
          {/if}
        </div>
      </a>
    {/each}
  </div>
{/if}

<style>
  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    color: var(--color-text-muted);
    margin-bottom: 2rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border-radius: 12px;
    border: 1px solid var(--color-border);
  }

  .incidents-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .incident-card {
    padding: 1rem 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    text-decoration: none;
    transition: border-color 0.15s;
  }

  .incident-card:hover {
    border-color: var(--color-primary);
    text-decoration: none;
  }

  .incident-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .severity {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .severity-minor { background: var(--color-degraded); color: #000; }
  .severity-major { background: #f97316; color: #000; }
  .severity-critical { background: var(--color-down); color: #fff; }

  .api-name {
    color: var(--color-text);
    font-weight: 600;
    font-size: 0.85rem;
  }

  .incident-status {
    margin-left: auto;
    font-size: 0.75rem;
    text-transform: capitalize;
    color: var(--color-text-muted);
  }

  h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 0.5rem;
  }

  .incident-footer {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
</style>
