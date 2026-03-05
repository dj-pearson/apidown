<script>
  import { getSupabase } from '$lib/supabase.js';

  let { data } = $props();
  let users = $state(data.users);

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function toggleAdmin(user) {
    const supabase = getSupabase();
    await supabase.from('users').update({ is_admin: !user.is_admin }).eq('id', user.id);
    users = users.map(u => u.id === user.id ? { ...u, is_admin: !u.is_admin } : u);
  }

  async function changeTier(user, tier) {
    const supabase = getSupabase();
    await supabase.from('users').update({ tier }).eq('id', user.id);
    users = users.map(u => u.id === user.id ? { ...u, tier } : u);
  }
</script>

<svelte:head><title>Manage Users — Admin — APIdown.net</title></svelte:head>

<h1>Manage Users</h1>
<nav class="admin-nav">
  <a href="/admin">Overview</a>
  <a href="/admin/apis">APIs</a>
  <a href="/admin/incidents">Incidents</a>
  <a href="/admin/users">Users</a>
</nav>

<table>
  <thead>
    <tr>
      <th>Email</th>
      <th>Name</th>
      <th>Tier</th>
      <th>Admin</th>
      <th>Joined</th>
    </tr>
  </thead>
  <tbody>
    {#each users as user (user.id)}
      <tr>
        <td>{user.email}</td>
        <td>{user.display_name || '—'}</td>
        <td>
          <select value={user.tier} onchange={(e) => changeTier(user, e.target.value)}>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="team">Team</option>
          </select>
        </td>
        <td>
          <button class="admin-toggle" class:is-admin={user.is_admin} onclick={() => toggleAdmin(user)}>
            {user.is_admin ? 'Yes' : 'No'}
          </button>
        </td>
        <td>{formatDate(user.created_at)}</td>
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
  select { padding: 0.3rem; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-bg); color: var(--color-text); font-size: 0.8rem; }
  .admin-toggle { background: none; border: 1px solid var(--color-border); padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; color: var(--color-text-muted); }
  .admin-toggle.is-admin { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
</style>
