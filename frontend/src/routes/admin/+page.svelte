<script>
  let { data } = $props();
  let stats = data.stats;
  let recentIncidents = data.recentIncidents;

  function formatDate(iso) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
</script>

<svelte:head>
  <title>Admin Dashboard — APIdown.net</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<h1>Admin Dashboard</h1>

<nav class="admin-nav">
  <a href="/admin">Overview</a>
  <a href="/admin/apis">APIs</a>
  <a href="/admin/incidents">Incidents</a>
  <a href="/admin/users">Users</a>
</nav>

<div class="stats-grid">
  <div class="stat-card">
    <span class="stat-value">{stats.apis}</span>
    <span class="stat-label">APIs Monitored</span>
  </div>
  <div class="stat-card">
    <span class="stat-value">{stats.users}</span>
    <span class="stat-label">Users</span>
  </div>
  <div class="stat-card">
    <span class="stat-value">{stats.activeIncidents}</span>
    <span class="stat-label">Active Incidents</span>
  </div>
  <div class="stat-card">
    <span class="stat-value">{stats.subscriptions}</span>
    <span class="stat-label">Alert Subscriptions</span>
  </div>
</div>

<section class="recent">
  <h2>Recent Incidents</h2>
  {#if recentIncidents.length === 0}
    <p class="empty">No incidents</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>API</th>
          <th>Title</th>
          <th>Severity</th>
          <th>Status</th>
          <th>Started</th>
        </tr>
      </thead>
      <tbody>
        {#each recentIncidents as inc (inc.id)}
          <tr>
            <td>{inc.apis?.name}</td>
            <td><a href="/incidents/{inc.id}">{inc.title}</a></td>
            <td><span class="severity severity-{inc.severity}">{inc.severity}</span></td>
            <td>{inc.status}</td>
            <td>{formatDate(inc.started_at)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  h1 { font-size: 1.5rem; margin-bottom: 1rem; }

  .admin-nav {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 0.75rem;
  }

  .admin-nav a {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .admin-nav a:hover { color: var(--color-text); text-decoration: none; }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1.25rem;
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .recent h2 { font-size: 1.1rem; margin-bottom: 1rem; }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    text-align: left;
    padding: 0.6rem 0.75rem;
    font-size: 0.85rem;
    border-bottom: 1px solid var(--color-border);
  }

  th {
    color: var(--color-text-muted);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .severity {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
  }

  .severity-minor { background: var(--color-degraded); color: #000; }
  .severity-major { background: #f97316; color: #000; }
  .severity-critical { background: var(--color-down); color: #fff; }

  .empty { color: var(--color-text-muted); font-size: 0.9rem; }
</style>
