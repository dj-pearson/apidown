<script>
  import { getSupabase } from '$lib/supabase.js';

  let { data } = $props();
  let incidents = $state(data.incidents);

  function formatDate(iso) {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function resolveIncident(inc) {
    const supabase = getSupabase();
    await supabase.from('incidents').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', inc.id);
    await supabase.from('apis').update({ current_status: 'operational' }).eq('id', inc.api_id);
    incidents = incidents.map(i => i.id === inc.id ? { ...i, status: 'resolved', resolved_at: new Date().toISOString() } : i);
  }
</script>

<svelte:head>
  <title>Manage Incidents — Admin — APIdown.net</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<h1>Manage Incidents</h1>
<nav class="admin-nav">
  <a href="/admin">Overview</a>
  <a href="/admin/apis">APIs</a>
  <a href="/admin/incidents">Incidents</a>
  <a href="/admin/users">Users</a>
</nav>

<table>
  <thead>
    <tr>
      <th>API</th>
      <th>Title</th>
      <th>Severity</th>
      <th>Status</th>
      <th>Started</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each incidents as inc (inc.id)}
      <tr>
        <td>{inc.apis?.name}</td>
        <td><a href="/incidents/{inc.id}">{inc.title}</a></td>
        <td><span class="severity severity-{inc.severity}">{inc.severity}</span></td>
        <td>{inc.status}</td>
        <td>{formatDate(inc.started_at)}</td>
        <td>
          {#if inc.status !== 'resolved'}
            <button class="btn-sm" onclick={() => resolveIncident(inc)}>Resolve</button>
          {:else}
            <span class="resolved">Resolved</span>
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  h1 { font-size: 1.5rem; margin-bottom: 1rem; }
  .admin-nav { display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.75rem; }
  .admin-nav a { font-size: 0.9rem; color: var(--color-text-muted); font-weight: 500; }
  .admin-nav a:hover { color: var(--color-text); text-decoration: none; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.6rem 0.75rem; font-size: 0.85rem; border-bottom: 1px solid var(--color-border); }
  th { color: var(--color-text-muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
  .severity { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 0.1rem 0.4rem; border-radius: 3px; }
  .severity-minor { background: var(--color-degraded); color: #000; }
  .severity-major { background: #f97316; color: #000; }
  .severity-critical { background: var(--color-down); color: #fff; }
  .btn-sm { background: var(--color-primary); color: #fff; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; }
  .resolved { color: var(--color-operational); font-size: 0.8rem; }
</style>
