<script>
  import { getSupabase } from '$lib/supabase.js';

  let { data } = $props();
  let apis = $state(data.apis);
  let showForm = $state(false);
  let form = $state({ name: '', slug: '', category: 'devtools', base_url: '', domains: '', logo_url: '', status_page: '' });
  let saving = $state(false);

  async function addApi() {
    saving = true;
    const supabase = getSupabase();
    const { error } = await supabase.from('apis').insert({
      ...form,
      domains: form.domains.split(',').map(d => d.trim()).filter(Boolean),
      current_status: 'operational',
    });
    if (!error) {
      location.reload();
    }
    saving = false;
  }

  async function deleteApi(id) {
    if (!confirm('Delete this API? This cannot be undone.')) return;
    const supabase = getSupabase();
    await supabase.from('apis').delete().eq('id', id);
    apis = apis.filter(a => a.id !== id);
  }

  async function toggleStatus(api) {
    const next = api.current_status === 'operational' ? 'degraded' : 'operational';
    const supabase = getSupabase();
    await supabase.from('apis').update({ current_status: next }).eq('id', api.id);
    apis = apis.map(a => a.id === api.id ? { ...a, current_status: next } : a);
  }
</script>

<svelte:head><title>Manage APIs — Admin — APIdown.net</title></svelte:head>

<h1>Manage APIs</h1>
<nav class="admin-nav">
  <a href="/admin">Overview</a>
  <a href="/admin/apis">APIs</a>
  <a href="/admin/incidents">Incidents</a>
  <a href="/admin/users">Users</a>
</nav>

<button class="btn-primary" onclick={() => showForm = !showForm}>
  {showForm ? 'Cancel' : 'Add API'}
</button>

{#if showForm}
  <form class="add-form" onsubmit={(e) => { e.preventDefault(); addApi(); }}>
    <input placeholder="Name" bind:value={form.name} required />
    <input placeholder="Slug" bind:value={form.slug} required />
    <select bind:value={form.category}>
      <option value="payments">Payments</option>
      <option value="ai">AI / LLM</option>
      <option value="communications">Communications</option>
      <option value="cloud-aws">Cloud — AWS</option>
      <option value="auth">Auth & Identity</option>
      <option value="database">Database / Storage</option>
      <option value="devtools">Dev Tools & Hosting</option>
    </select>
    <input placeholder="Base URL" bind:value={form.base_url} />
    <input placeholder="Domains (comma-separated)" bind:value={form.domains} />
    <input placeholder="Logo URL" bind:value={form.logo_url} />
    <input placeholder="Vendor Status Page URL" bind:value={form.status_page} />
    <button type="submit" class="btn-primary" disabled={saving}>
      {saving ? 'Saving...' : 'Save'}
    </button>
  </form>
{/if}

<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Slug</th>
      <th>Category</th>
      <th>Status</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each apis as api (api.id)}
      <tr>
        <td>{api.name}</td>
        <td><code>{api.slug}</code></td>
        <td>{api.category}</td>
        <td>
          <button class="status-toggle" onclick={() => toggleStatus(api)}>
            <span class="dot" style="background: {api.current_status === 'operational' ? 'var(--color-operational)' : api.current_status === 'degraded' ? 'var(--color-degraded)' : 'var(--color-down)'}"></span>
            {api.current_status}
          </button>
        </td>
        <td>
          <button class="btn-danger-sm" onclick={() => deleteApi(api.id)}>Delete</button>
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

  .btn-primary { background: var(--color-primary); color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; margin-bottom: 1rem; }
  .btn-primary:disabled { opacity: 0.5; }
  .btn-danger-sm { background: none; color: var(--color-down); border: 1px solid var(--color-down); padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; }

  .add-form { display: flex; flex-direction: column; gap: 0.5rem; max-width: 400px; margin-bottom: 1.5rem; padding: 1rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; }
  .add-form input, .add-form select { padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); font-size: 0.85rem; }

  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.6rem 0.75rem; font-size: 0.85rem; border-bottom: 1px solid var(--color-border); }
  th { color: var(--color-text-muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
  code { font-size: 0.8rem; }

  .status-toggle { background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--color-text); text-transform: capitalize; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
</style>
