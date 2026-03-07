<script>
  import { createClient } from '@supabase/supabase-js';

  let { data } = $props();
  let targets = $state(data.targets || []);
  let availableApis = $state(data.availableApis || []);

  // Add target form state
  let selectedApiId = $state('');
  let uptimeTarget = $state('99.9');
  let p95Target = $state('1000');
  let addingTarget = $state(false);
  let addError = $state('');

  // Delete state
  let confirmDeleteId = $state(null);
  let deleting = $state(false);

  function getAuthClient() {
    const url = data.supabaseUrl;
    const key = data.supabaseAnonKey;
    if (!url || !key) return null;
    return createClient(url, key);
  }

  async function addTarget() {
    if (!selectedApiId) return;
    addingTarget = true;
    addError = '';
    try {
      const supabase = getAuthClient();
      if (!supabase) throw new Error('Not connected');
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase.from('sla_targets').insert({
        user_id: userId,
        api_id: selectedApiId,
        uptime_target_pct: parseFloat(uptimeTarget),
        latency_p95_target_ms: parseInt(p95Target),
      });

      if (error) throw error;

      // Reload page to get fresh computed data
      window.location.reload();
    } catch (err) {
      addError = err.message || 'Failed to add target';
    }
    addingTarget = false;
  }

  async function deleteTarget(id) {
    deleting = true;
    try {
      const supabase = getAuthClient();
      if (!supabase) return;
      await supabase.from('sla_targets').delete().eq('id', id);
      targets = targets.filter(t => t.id !== id);
      confirmDeleteId = null;
    } catch { /* ignore */ }
    deleting = false;
  }

  function exportCsv() {
    const headers = ['API Name', 'Target Uptime %', 'Actual Uptime %', 'Target P95 ms', 'Downtime (min)', 'Status'];
    const rows = targets.map(t => [
      t.api_name,
      t.uptime_target_pct,
      t.actual_uptime_pct,
      t.latency_p95_target_ms,
      t.downtime_minutes,
      t.passing ? 'PASS' : 'FAIL',
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sla-report-${data.month || 'current'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>SLA Tracking & Uptime Targets — APIdown.net</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<a href="/dashboard" class="back">&larr; Dashboard</a>

<h1>SLA Target Tracking</h1>

{#if data.requiresUpgrade}
  <div class="upgrade-prompt">
    <h2>Pro Feature</h2>
    <p>SLA target tracking with pass/fail reporting is available on Pro and Business plans.</p>
    <a href="/pricing" class="pro-btn">Upgrade to Pro</a>
  </div>
{:else}
  {#if targets.length > 0}
    <p class="summary">
      <strong>{data.summary.passing} of {data.summary.total}</strong> SLA target{data.summary.total === 1 ? '' : 's'} met this month
      {#if data.month}
        <span class="summary-month">({data.month})</span>
      {/if}
    </p>

    <div class="table-actions">
      <button class="btn-csv" onclick={exportCsv}>Export CSV</button>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>API Name</th>
            <th>Target Uptime</th>
            <th>Actual Uptime</th>
            <th>Target P95</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each targets as target (target.id)}
            <tr>
              <td><a href="/api/{target.api_slug}">{target.api_name}</a></td>
              <td>{target.uptime_target_pct}%</td>
              <td class:uptime-fail={!target.uptime_passing}>{target.actual_uptime_pct}%</td>
              <td>{target.latency_p95_target_ms}ms</td>
              <td>
                <span class="badge" class:badge-pass={target.passing} class:badge-fail={!target.passing}>
                  {target.passing ? 'PASS' : 'FAIL'}
                </span>
              </td>
              <td>
                {#if confirmDeleteId === target.id}
                  <button class="btn-danger-sm" onclick={() => deleteTarget(target.id)} disabled={deleting}>Confirm</button>
                  <button class="btn-cancel-sm" onclick={() => confirmDeleteId = null}>Cancel</button>
                {:else}
                  <button class="btn-remove" onclick={() => confirmDeleteId = target.id}>Remove</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="empty">No SLA targets configured. Add one below to start tracking.</p>
  {/if}

  {#if availableApis.length > 0}
    <div class="add-target">
      <h2>Add Target</h2>
      <p class="section-desc">Select a pinned API and set your SLA thresholds.</p>
      <form onsubmit={(e) => { e.preventDefault(); addTarget(); }}>
        <div class="form-row">
          <label>
            API
            <select bind:value={selectedApiId} required>
              <option value="">Select an API...</option>
              {#each availableApis as api}
                <option value={api.api_id}>{api.name}</option>
              {/each}
            </select>
          </label>
          <label>
            Uptime Target (%)
            <input type="number" step="0.001" min="0" max="100" bind:value={uptimeTarget} required />
          </label>
          <label>
            P95 Latency Target (ms)
            <input type="number" step="1" min="1" bind:value={p95Target} required />
          </label>
          <button type="submit" disabled={addingTarget || !selectedApiId}>
            {addingTarget ? 'Adding...' : 'Add Target'}
          </button>
        </div>
      </form>
      {#if addError}
        <p class="error">{addError}</p>
      {/if}
    </div>
  {:else if targets.length > 0}
    <p class="hint">All pinned APIs have targets. Pin more APIs from their detail pages to add more.</p>
  {:else}
    <p class="hint">Pin APIs from their detail pages first, then add SLA targets here.</p>
  {/if}
{/if}

<style>
  .back {
    display: inline-block;
    margin-bottom: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .upgrade-prompt {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 2rem;
    text-align: center;
  }

  .upgrade-prompt h2 {
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
  }

  .upgrade-prompt p {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .pro-btn {
    display: inline-block;
    background: var(--color-primary);
    color: white;
    padding: 0.5rem 1.25rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .pro-btn:hover { opacity: 0.9; }

  .summary {
    font-size: 0.95rem;
    margin-bottom: 1rem;
  }

  .summary-month {
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .table-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.75rem;
  }

  .btn-csv {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
    color: var(--color-text);
    cursor: pointer;
    font-weight: 500;
  }

  .btn-csv:hover { border-color: var(--color-primary); }

  .table-wrapper {
    overflow-x: auto;
    margin-bottom: 2rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  th {
    text-align: left;
    padding: 0.6rem 0.75rem;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--color-text-muted);
    border-bottom: 2px solid var(--color-border);
  }

  td {
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text);
  }

  td a {
    color: var(--color-primary);
    text-decoration: none;
  }

  td a:hover { text-decoration: underline; }

  .uptime-fail {
    color: var(--color-down);
    font-weight: 600;
  }

  .badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .badge-pass {
    background: var(--color-operational);
    color: #000;
  }

  .badge-fail {
    background: var(--color-down);
    color: #fff;
  }

  .btn-remove {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;
  }

  .btn-remove:hover { color: var(--color-down); }

  .btn-danger-sm {
    background: var(--color-down);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    cursor: pointer;
    margin-right: 0.25rem;
  }

  .btn-cancel-sm {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    cursor: pointer;
    color: var(--color-text-muted);
  }

  .empty {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin-bottom: 2rem;
  }

  .hint {
    color: var(--color-text-muted);
    font-size: 0.8rem;
    margin-top: 1rem;
  }

  .add-target {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1.25rem;
  }

  .add-target h2 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .section-desc {
    color: var(--color-text-muted);
    font-size: 0.8rem;
    margin-bottom: 1rem;
  }

  .form-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .form-row label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .form-row select,
  .form-row input {
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.85rem;
  }

  .form-row select:focus,
  .form-row input:focus {
    border-color: var(--color-primary);
    outline: none;
  }

  .form-row select { min-width: 180px; }
  .form-row input { width: 120px; }

  .form-row button {
    background: var(--color-primary);
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .form-row button:hover { opacity: 0.85; }
  .form-row button:disabled { opacity: 0.5; cursor: not-allowed; }

  .error {
    color: var(--color-down);
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }

  @media (max-width: 640px) {
    .form-row {
      flex-direction: column;
      align-items: stretch;
    }
    .form-row select,
    .form-row input {
      width: 100%;
      min-width: unset;
    }
  }
</style>
