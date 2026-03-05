<script>
  let { data } = $props();
  let incident = $state(data.incident);

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    });
  }

  let duration = $derived.by(() => {
    const start = new Date(incident.started_at).getTime();
    const end = incident.resolved_at ? new Date(incident.resolved_at).getTime() : Date.now();
    const mins = Math.round((end - start) / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  });
</script>

<svelte:head>
  <title>{incident.title} — APIdown.net</title>
  <meta name="description" content="{incident.title} — Incident details from APIdown.net" />
</svelte:head>

<a href="/incidents" class="back">&larr; All Incidents</a>

<div class="incident-detail">
  <div class="header">
    <span class="severity severity-{incident.severity}">{incident.severity}</span>
    <span class="status">{incident.status}</span>
  </div>

  <h1>{incident.title}</h1>

  <div class="meta">
    <a href="/api/{incident.apis?.slug}" class="api-link">{incident.apis?.name}</a>
    <span>·</span>
    <span>Started {formatDate(incident.started_at)}</span>
    {#if incident.resolved_at}
      <span>·</span>
      <span>Resolved {formatDate(incident.resolved_at)}</span>
    {/if}
    <span>·</span>
    <span>Duration: {duration}</span>
  </div>

  {#if incident.regions?.length > 0}
    <div class="regions">
      <strong>Affected regions:</strong>
      {#each incident.regions as region}
        <span class="region-tag">{region}</span>
      {/each}
    </div>
  {/if}

  <div class="info-box">
    <p>This incident was {incident.auto_created ? 'automatically detected' : 'manually reported'} by APIdown.net based on {incident.auto_created ? 'anomalous signal data from real production traffic.' : 'user reports.'}</p>
  </div>
</div>

<style>
  .back {
    display: inline-block;
    margin-bottom: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .incident-detail {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 2rem;
  }

  .header {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  .severity {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
  }

  .severity-minor { background: var(--color-degraded); color: #000; }
  .severity-major { background: #f97316; color: #000; }
  .severity-critical { background: var(--color-down); color: #fff; }

  .status {
    text-transform: capitalize;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.75rem;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }

  .api-link {
    font-weight: 600;
  }

  .regions {
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }

  .region-tag {
    display: inline-block;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-family: var(--font-mono);
    margin-left: 0.25rem;
  }

  .info-box {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
</style>
