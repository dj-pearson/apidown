<script>
  import { enhance } from '$app/forms';

  let { data, form: actionResult } = $props();
  let apis = $state(data.apis);

  // Reactively update when data changes (after form submissions)
  $effect(() => { apis = data.apis; });

  let showCreate = $state(false);
  let editApi = $state(null);

  const categories = [
    { value: 'payments', label: 'Payments' },
    { value: 'ai', label: 'AI / LLM' },
    { value: 'communications', label: 'Communications' },
    { value: 'cloud-aws', label: 'Cloud — AWS' },
    { value: 'cloud-gcp', label: 'Cloud — GCP' },
    { value: 'cloud-azure', label: 'Cloud — Azure' },
    { value: 'auth', label: 'Auth & Identity' },
    { value: 'database', label: 'Database / Storage' },
    { value: 'devtools', label: 'Dev Tools & Hosting' },
    { value: 'commerce', label: 'Commerce & Shipping' },
  ];

  const statusOptions = ['operational', 'degraded', 'down'];

  function openEdit(api) {
    editApi = { ...api, base_domains_str: (api.base_domains || []).join(', ') };
  }

  function closeEdit() { editApi = null; }
  function closeCreate() { showCreate = false; }
</script>

<svelte:head>
  <title>Manage APIs — Admin — APIdown.net</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<h1>Manage APIs</h1>
<nav class="admin-nav">
  <a href="/admin">Overview</a>
  <a href="/admin/apis" class="active">APIs</a>
  <a href="/admin/incidents">Incidents</a>
  <a href="/admin/users">Users</a>
</nav>

{#if actionResult?.error}
  <div class="alert alert-error">{actionResult.error}</div>
{/if}
{#if actionResult?.success}
  <div class="alert alert-success">Saved successfully.</div>
{/if}

<button class="btn-primary" onclick={() => showCreate = !showCreate}>
  {showCreate ? 'Cancel' : '+ Add API'}
</button>

<span class="api-count">{apis.length} APIs</span>

<!-- Create Form -->
{#if showCreate}
  <div class="modal-backdrop" onclick={closeCreate} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
      <h2>Add New API</h2>
      <form method="POST" action="?/create" use:enhance={() => {
        return async ({ update }) => {
          await update();
          showCreate = false;
        };
      }}>
        <label>
          Name <input name="name" required placeholder="e.g. Stripe" />
        </label>
        <label>
          Slug <input name="slug" required placeholder="e.g. stripe" pattern="[a-z0-9\-]+" title="Lowercase letters, numbers, hyphens" />
        </label>
        <label>
          Category
          <select name="category" required>
            {#each categories as cat}
              <option value={cat.value}>{cat.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Base Domains <input name="base_domains" required placeholder="api.stripe.com, js.stripe.com" />
          <span class="hint">Comma-separated</span>
        </label>
        <label>
          Logo URL <input name="logo_url" placeholder="/logos/stripe.svg" />
        </label>
        <label>
          Vendor Status Page <input name="status_page" type="url" placeholder="https://status.stripe.com" />
        </label>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick={closeCreate}>Cancel</button>
          <button type="submit" class="btn-primary">Create API</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if editApi}
  <div class="modal-backdrop" onclick={closeEdit} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
      <h2>Edit: {editApi.name}</h2>
      <form method="POST" action="?/update" use:enhance={() => {
        return async ({ update }) => {
          await update();
          editApi = null;
        };
      }}>
        <input type="hidden" name="id" value={editApi.id} />
        <label>
          Name <input name="name" required bind:value={editApi.name} />
        </label>
        <label>
          Slug <input name="slug" required bind:value={editApi.slug} pattern="[a-z0-9\-]+" />
        </label>
        <label>
          Category
          <select name="category" required bind:value={editApi.category}>
            {#each categories as cat}
              <option value={cat.value}>{cat.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Base Domains <input name="base_domains" required bind:value={editApi.base_domains_str} />
          <span class="hint">Comma-separated</span>
        </label>
        <label>
          Logo URL <input name="logo_url" bind:value={editApi.logo_url} />
        </label>
        <label>
          Vendor Status Page <input name="status_page" type="url" bind:value={editApi.status_page} />
        </label>
        <label>
          Status
          <select name="current_status" bind:value={editApi.current_status}>
            {#each statusOptions as s}
              <option value={s}>{s}</option>
            {/each}
          </select>
        </label>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick={closeEdit}>Cancel</button>
          <button type="submit" class="btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- APIs Table -->
<table>
  <thead>
    <tr>
      <th>Logo</th>
      <th>Name</th>
      <th>Slug</th>
      <th>Category</th>
      <th>Domains</th>
      <th>Status</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each apis as api (api.id)}
      <tr>
        <td>
          {#if api.logo_url}
            <img src={api.logo_url} alt="" class="table-logo" />
          {:else}
            <div class="logo-placeholder">{api.name[0]}</div>
          {/if}
        </td>
        <td class="name-cell">{api.name}</td>
        <td><code>{api.slug}</code></td>
        <td>{api.category}</td>
        <td class="domains-cell">{(api.base_domains || []).join(', ')}</td>
        <td>
          <form method="POST" action="?/toggleStatus" use:enhance class="inline-form">
            <input type="hidden" name="id" value={api.id} />
            <input type="hidden" name="current_status" value={api.current_status} />
            <button type="submit" class="status-toggle">
              <span class="dot dot-{api.current_status}"></span>
              {api.current_status}
            </button>
          </form>
        </td>
        <td class="actions-cell">
          <button class="btn-edit" onclick={() => openEdit(api)}>Edit</button>
          <form method="POST" action="?/delete" use:enhance={() => {
            return async ({ update, cancel }) => {
              if (!confirm(`Delete "${api.name}"? This cannot be undone.`)) {
                cancel();
                return;
              }
              await update();
            };
          }} class="inline-form">
            <input type="hidden" name="id" value={api.id} />
            <button type="submit" class="btn-danger-sm">Delete</button>
          </form>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  h1 { font-size: 1.5rem; margin-bottom: 1rem; }
  h2 { font-size: 1.2rem; margin-bottom: 1rem; }

  .admin-nav { display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.75rem; }
  .admin-nav a { font-size: 0.9rem; color: var(--color-text-muted); font-weight: 500; text-decoration: none; padding-bottom: 0.75rem; border-bottom: 2px solid transparent; margin-bottom: -0.8rem; }
  .admin-nav a:hover { color: var(--color-text); }
  .admin-nav a.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

  .api-count { margin-left: 1rem; font-size: 0.85rem; color: var(--color-text-muted); }

  .alert { padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.85rem; }
  .alert-error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
  .alert-success { background: rgba(52, 211, 153, 0.1); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); }

  .btn-primary { background: var(--color-primary); color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; }
  .btn-secondary { background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
  .btn-edit { background: none; color: var(--color-primary); border: 1px solid var(--color-primary); padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; }
  .btn-danger-sm { background: none; color: var(--color-down); border: 1px solid var(--color-down); padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; }

  .inline-form { display: inline; }

  /* Modal */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .modal { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 1.5rem; width: 90%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
  .modal label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--color-text-muted); font-weight: 500; margin-bottom: 0.75rem; }
  .modal input, .modal select { padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font-size: 0.85rem; }
  .modal .hint { font-size: 0.7rem; color: var(--color-text-muted); }
  .form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
  th, td { text-align: left; padding: 0.6rem 0.75rem; font-size: 0.85rem; border-bottom: 1px solid var(--color-border); }
  th { color: var(--color-text-muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
  code { font-size: 0.8rem; }
  .name-cell { font-weight: 500; }
  .domains-cell { font-size: 0.75rem; color: var(--color-text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .actions-cell { display: flex; gap: 0.4rem; align-items: center; }

  .table-logo { width: 24px; height: 24px; border-radius: 4px; }
  .logo-placeholder { width: 24px; height: 24px; border-radius: 4px; background: var(--color-border); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; }

  .status-toggle { background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--color-text); text-transform: capitalize; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-operational { background: var(--color-operational); }
  .dot-degraded { background: var(--color-degraded); }
  .dot-down { background: var(--color-down); }
</style>
