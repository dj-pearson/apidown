<script>
  import { createClient } from '@supabase/supabase-js';
  import { goto } from '$app/navigation';

  let { data } = $props();
  let profile = $state(data.profile);
  let apiKeys = $state(data.apiKeys);
  let subscriptions = $state(data.subscriptions);

  let newKeyLabel = $state('');
  let creatingKey = $state(false);
  let newKeyValue = $state('');
  let openingPortal = $state(false);

  function getAuthClient() {
    const url = data.supabaseUrl;
    const key = data.supabaseAnonKey;
    if (!url || !key) return null;
    return createClient(url, key);
  }

  async function createApiKey() {
    creatingKey = true;
    try {
      // Get current session token for auth
      const supabase = getAuthClient();
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : {};
      const token = sessionData?.session?.access_token;

      if (!token) {
        alert('Please log in again to create an API key.');
        creatingKey = false;
        return;
      }

      const res = await fetch(`${data.ingestUrl}/v1/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ label: newKeyLabel || 'Default' }),
      });
      if (res.ok) {
        const body = await res.json();
        newKeyValue = body.key;
        newKeyLabel = '';
        location.reload();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create API key');
      }
    } catch {
      // ignore
    }
    creatingKey = false;
  }

  async function revokeKey(keyId) {
    const supabase = getAuthClient();
    if (!supabase) return;
    await supabase.from('api_keys').update({ is_active: false }).eq('id', keyId);
    apiKeys = apiKeys.map(k => k.id === keyId ? { ...k, is_active: false } : k);
  }

  async function logout() {
    const supabase = getAuthClient();
    if (supabase) await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; Max-Age=0; path=/';
    document.cookie = 'sb-refresh-token=; Max-Age=0; path=/';
    goto('/');
  }

  async function openBillingPortal() {
    openingPortal = true;
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        alert('Could not open billing portal.');
        openingPortal = false;
      }
    } catch {
      alert('Something went wrong.');
      openingPortal = false;
    }
  }

  function formatDate(iso) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Dashboard — APIdown.net</title>
</svelte:head>

<div class="dashboard-header">
  <div>
    <h1>Dashboard</h1>
    <p class="email">{profile.email}</p>
  </div>
  <div class="header-actions">
    <span class="tier-badge">{profile.tier}</span>
    <button class="btn-secondary" onclick={logout}>Log Out</button>
  </div>
</div>

<section class="section">
  <h2>Subscription</h2>
  <p class="section-desc">Your current plan and billing details.</p>

  <div class="billing-card">
    <div class="billing-info">
      <span class="tier-label">{profile.tier} plan</span>
      {#if profile.billing_period_end}
        <span class="billing-date">Renews {formatDate(profile.billing_period_end)}</span>
      {/if}
    </div>
    <div class="billing-actions">
      {#if profile.stripe_customer_id}
        <button class="btn-secondary" onclick={openBillingPortal} disabled={openingPortal}>
          {openingPortal ? 'Opening…' : 'Manage Billing'}
        </button>
      {:else if profile.tier === 'free'}
        <a href="/pricing" class="btn-primary">Upgrade</a>
      {/if}
    </div>
  </div>
</section>

<section class="section">
  <h2>API Keys</h2>
  <p class="section-desc">Use an API key to authenticate signal submissions from SDKs.</p>

  {#if apiKeys.length > 0}
    <div class="key-list">
      {#each apiKeys as key (key.id)}
        <div class="key-row" class:revoked={!key.is_active}>
          <div class="key-info">
            <span class="key-prefix">{key.key_prefix}...</span>
            <span class="key-label">{key.label}</span>
          </div>
          <div class="key-meta">
            <span>Created {formatDate(key.created_at)}</span>
            <span>Last used {formatDate(key.last_used_at)}</span>
            {#if key.is_active}
              <button class="btn-danger-sm" onclick={() => revokeKey(key.id)}>Revoke</button>
            {:else}
              <span class="revoked-label">Revoked</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="empty">No API keys yet.</p>
  {/if}

  <div class="create-key">
    <input type="text" bind:value={newKeyLabel} placeholder="Key label (optional)" />
    <button class="btn-primary" onclick={createApiKey} disabled={creatingKey}>
      {creatingKey ? 'Creating...' : 'Create API Key'}
    </button>
  </div>

  {#if newKeyValue}
    <div class="new-key-notice">
      <strong>Your new API key (copy it now — it won't be shown again):</strong>
      <code>{newKeyValue}</code>
    </div>
  {/if}
</section>

<section class="section">
  <h2>Alert Subscriptions</h2>
  <p class="section-desc">APIs you're subscribed to for status change alerts.</p>

  {#if subscriptions.length > 0}
    <div class="sub-list">
      {#each subscriptions as sub (sub.id)}
        <div class="sub-row">
          <a href="/api/{sub.apis?.slug}" class="sub-api">{sub.apis?.name}</a>
          <span class="sub-channel">{sub.channel}</span>
          <span class="sub-dest">{sub.destination}</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="empty">No subscriptions. Visit an API's detail page to subscribe.</p>
  {/if}
</section>

<style>
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 1.5rem;
  }

  .email {
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .tier-badge {
    background: var(--color-primary);
    color: #fff;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .section {
    margin-bottom: 2.5rem;
  }

  .section h2 {
    font-size: 1.1rem;
    margin-bottom: 0.25rem;
  }

  .section-desc {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }

  .key-list, .sub-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .key-row, .sub-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .key-row.revoked {
    opacity: 0.5;
  }

  .key-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .key-prefix {
    font-family: var(--font-mono, monospace);
    font-size: 0.85rem;
    color: var(--color-text);
  }

  .key-label {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .key-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .revoked-label {
    color: var(--color-down);
    font-weight: 600;
    font-size: 0.75rem;
  }

  .create-key {
    display: flex;
    gap: 0.5rem;
  }

  .create-key input {
    flex: 1;
    max-width: 250px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.85rem;
  }

  .new-key-notice {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-operational);
    border-radius: 8px;
  }

  .new-key-notice code {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.9rem;
    word-break: break-all;
    color: var(--color-operational);
  }

  .sub-api {
    font-weight: 600;
    color: var(--color-text);
  }

  .sub-channel {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    text-transform: capitalize;
  }

  .sub-dest {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono, monospace);
  }

  .btn-primary {
    background: var(--color-primary);
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .btn-primary:hover { opacity: 0.9; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .btn-secondary:hover { border-color: var(--color-text-muted); }

  .billing-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .billing-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .tier-label {
    font-weight: 600;
    text-transform: capitalize;
    font-size: 0.95rem;
  }

  .billing-date {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .billing-actions {
    display: flex;
    gap: 0.5rem;
  }

  .billing-actions .btn-primary {
    text-decoration: none;
  }

  .btn-danger-sm {
    background: none;
    color: var(--color-down);
    border: 1px solid var(--color-down);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .empty {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  @media (max-width: 640px) {
    .dashboard-header { flex-direction: column; gap: 0.75rem; }
    .key-row { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
    .key-meta { flex-wrap: wrap; }
    .create-key { flex-direction: column; }
    .create-key input { max-width: 100%; }
  }
</style>
