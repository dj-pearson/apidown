<script>
  import { createClient } from '@supabase/supabase-js';
  import { goto } from '$app/navigation';
  import { getTierLimits, getNextTier } from '$lib/tier-limits.js';
  import UpgradeModal from '$lib/components/UpgradeModal.svelte';

  let { data } = $props();
  let profile = $state(data.profile);
  let apiKeys = $state(data.apiKeys);
  let pinnedApis = $state(data.pinnedApis);
  let editingCostId = $state(null);
  let costInput = $state('');
  let digestFrequency = $state(data.profile.digest_frequency || 'none');
  let subscriptions = $state(data.subscriptions);

  let newKeyLabel = $state('');
  let creatingKey = $state(false);
  let newKeyValue = $state('');
  let openingPortal = $state(false);
  let copiedKey = $state(false);
  let confirmRevokeId = $state(null);
  let showUpgradeModal = $state(false);
  let upgradeLimitType = $state('apiKeys');

  const tier = $derived(profile.tier || 'free');
  const limits = $derived(getTierLimits(tier));
  const activeKeyCount = $derived(apiKeys.filter(k => k.is_active).length);
  const subCount = $derived(subscriptions.length);
  const hasNextTier = $derived(getNextTier(tier) !== null);

  function formatLimit(n) {
    return n === Infinity ? 'Unlimited' : n;
  }

  function usagePercent(current, max) {
    if (max === Infinity) return 0;
    return Math.min(Math.round((current / max) * 100), 100);
  }

  function usageColor(current, max) {
    if (max === Infinity) return 'var(--color-operational, #4ade80)';
    const pct = current / max;
    if (pct >= 1) return 'var(--color-down, #ef4444)';
    if (pct >= 0.5) return 'var(--color-degraded, #f59e0b)';
    return 'var(--color-operational, #4ade80)';
  }

  async function updateDigestFrequency(freq) {
    digestFrequency = freq;
    const supabase = getAuthClient();
    if (!supabase) return;
    await supabase.from('users').update({ digest_frequency: freq }).eq('id', data.profile.id || '');
  }

  async function saveCost(apiId) {
    const supabase = getAuthClient();
    if (!supabase) return;
    const cents = Math.round(parseFloat(costInput || '0') * 100);
    await supabase
      .from('pinned_apis')
      .update({ cost_per_minute_cents: cents })
      .eq('user_id', data.profile.id || '')
      .eq('api_id', apiId);
    pinnedApis = pinnedApis.map(p =>
      p.api_id === apiId ? { ...p, cost_per_minute_cents: cents } : p
    );
    editingCostId = null;
  }

  function getAuthClient() {
    const url = data.supabaseUrl;
    const key = data.supabaseAnonKey;
    if (!url || !key) return null;
    return createClient(url, key);
  }

  async function createApiKey() {
    if (activeKeyCount >= limits.apiKeys && hasNextTier) {
      upgradeLimitType = 'apiKeys';
      showUpgradeModal = true;
      return;
    }
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

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      copiedKey = true;
      setTimeout(() => copiedKey = false, 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      copiedKey = true;
      setTimeout(() => copiedKey = false, 2000);
    }
  }

  async function revokeKey(keyId) {
    const supabase = getAuthClient();
    if (!supabase) return;
    await supabase.from('api_keys').update({ is_active: false }).eq('id', keyId);
    apiKeys = apiKeys.map(k => k.id === keyId ? { ...k, is_active: false } : k);
    confirmRevokeId = null;
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
  <meta name="robots" content="noindex, nofollow" />
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

  <div class="digest-setting">
    <span class="digest-label">Status digest emails</span>
    <div class="digest-options">
      {#each [
        { value: 'none', label: 'Off' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'daily', label: 'Daily', pro: true },
      ] as opt (opt.value)}
        {@const locked = opt.pro && tier === 'free'}
        <button
          class="digest-btn"
          class:active={digestFrequency === opt.value}
          class:locked
          disabled={locked}
          onclick={() => !locked && updateDigestFrequency(opt.value)}
        >
          {opt.label}
          {#if locked}
            <span class="digest-pro-badge">Pro</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</section>

<section class="section">
  <h2>My Stack</h2>
  <p class="section-desc">Your pinned API dependencies. Pin APIs from their detail pages.</p>

  {#if pinnedApis.length > 0}
    <div class="stack-grid">
      {#each pinnedApis as pin (pin.api_id)}
        {@const api = pin.apis}
        <div class="stack-card">
          <a href="/api/{api.slug}" class="stack-card-link">
            <div class="stack-card-header">
              {#if api.logo_url}
                <img src={api.logo_url} alt={api.name} class="stack-logo" />
              {:else}
                <div class="stack-logo-placeholder">{api.name[0]}</div>
              {/if}
              <span class="stack-name">{api.name}</span>
            </div>
            <span class="stack-status stack-status-{api.current_status}">
              {api.current_status}
            </span>
          </a>
          <div class="stack-cost">
            {#if editingCostId === pin.api_id}
              <div class="cost-edit">
                <span class="cost-prefix">$</span>
                <input type="number" step="0.01" min="0" bind:value={costInput} placeholder="0.00" class="cost-input" />
                <span class="cost-suffix">/min</span>
                <button class="btn-cost-save" onclick={() => saveCost(pin.api_id)}>Save</button>
              </div>
            {:else}
              <button class="cost-toggle" onclick={() => { editingCostId = pin.api_id; costInput = ((pin.cost_per_minute_cents || 0) / 100).toFixed(2); }}>
                {pin.cost_per_minute_cents > 0 ? `$${(pin.cost_per_minute_cents / 100).toFixed(2)}/min` : 'Set cost'}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="empty">No pinned APIs. Visit an API's detail page and click the star to pin it.</p>
  {/if}

  {#if pinnedApis.length > 0}
    {@const downCount = pinnedApis.filter(p => p.apis.current_status === 'down').length}
    {@const degradedCount = pinnedApis.filter(p => p.apis.current_status === 'degraded').length}
    <p class="stack-summary">
      {#if downCount > 0}
        <span class="stack-alert">{downCount} API{downCount > 1 ? 's' : ''} down</span>
      {:else if degradedCount > 0}
        <span class="stack-warn">{degradedCount} API{degradedCount > 1 ? 's' : ''} degraded</span>
      {:else}
        <span class="stack-ok">All operational</span>
      {/if}
    </p>
  {/if}
</section>

<section class="section">
  <div class="section-header-row">
    <div>
      <h2>API Keys</h2>
      <p class="section-desc">Use an API key to authenticate signal submissions from SDKs.</p>
    </div>
    <span class="usage-count">{activeKeyCount}/{formatLimit(limits.apiKeys)}</span>
  </div>
  <div class="usage-bar">
    <div
      class="usage-fill"
      class:at-limit={activeKeyCount >= limits.apiKeys && limits.apiKeys !== Infinity}
      style="width: {usagePercent(activeKeyCount, limits.apiKeys)}%; background: {usageColor(activeKeyCount, limits.apiKeys)}"
    ></div>
  </div>

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
              {#if confirmRevokeId === key.id}
                <span class="confirm-revoke">
                  Sure?
                  <button class="btn-danger-sm" onclick={() => revokeKey(key.id)}>Yes, revoke</button>
                  <button class="btn-cancel-sm" onclick={() => confirmRevokeId = null}>Cancel</button>
                </span>
              {:else}
                <button class="btn-danger-sm" onclick={() => confirmRevokeId = key.id} aria-label="Revoke API key {key.label}">Revoke</button>
              {/if}
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
      <strong>Your new API key (save it now — it won't be shown again):</strong>
      <div class="key-display">
        <code>{newKeyValue}</code>
        <button class="btn-copy" onclick={() => copyToClipboard(newKeyValue)} aria-label="Copy API key to clipboard">
          {copiedKey ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  {/if}
</section>

<section class="section">
  <div class="section-header-row">
    <div>
      <h2>Alert Subscriptions</h2>
      <p class="section-desc">APIs you're subscribed to for status change alerts.</p>
    </div>
    <span class="usage-count">{subCount}/{formatLimit(limits.subscriptions)}</span>
  </div>
  <div class="usage-bar">
    <div
      class="usage-fill"
      class:at-limit={subCount >= limits.subscriptions && limits.subscriptions !== Infinity}
      style="width: {usagePercent(subCount, limits.subscriptions)}%; background: {usageColor(subCount, limits.subscriptions)}"
    ></div>
  </div>

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

<UpgradeModal
  bind:show={showUpgradeModal}
  currentTier={tier}
  limitType={upgradeLimitType}
  currentUsage={upgradeLimitType === 'apiKeys' ? activeKeyCount : subCount}
  maxUsage={upgradeLimitType === 'apiKeys' ? formatLimit(limits.apiKeys) : formatLimit(limits.subscriptions)}
/>

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
    margin-bottom: 0.5rem;
  }

  .section-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .usage-count {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
    white-space: nowrap;
    margin-top: 0.15rem;
  }

  .usage-bar {
    height: 4px;
    background: var(--color-border, #333);
    border-radius: 2px;
    margin-bottom: 1rem;
    overflow: hidden;
  }

  .usage-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
    min-width: 2px;
  }

  .usage-fill.at-limit {
    animation: pulse-bar 1.5s ease-in-out infinite;
  }

  @keyframes pulse-bar {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .stack-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .stack-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    transition: border-color 0.15s;
  }

  .stack-card:hover { border-color: var(--color-primary); }

  .stack-card-link {
    text-decoration: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stack-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stack-logo {
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }

  .stack-logo-placeholder {
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

  .stack-name {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--color-text);
  }

  .stack-status {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .stack-status-operational { color: var(--color-operational); }
  .stack-status-degraded { color: var(--color-degraded); }
  .stack-status-down { color: var(--color-down); }

  .stack-summary {
    font-size: 0.8rem;
    font-weight: 600;
  }

  .stack-ok { color: var(--color-operational); }
  .stack-warn { color: var(--color-degraded); }
  .stack-alert { color: var(--color-down); }

  .stack-cost {
    border-top: 1px solid var(--color-border);
    padding-top: 0.4rem;
  }

  .cost-toggle {
    background: none;
    border: none;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0;
  }

  .cost-toggle:hover { color: var(--color-primary); }

  .cost-edit {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.75rem;
  }

  .cost-prefix, .cost-suffix {
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }

  .cost-input {
    width: 50px;
    padding: 0.15rem 0.3rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.7rem;
  }

  .btn-cost-save {
    background: var(--color-primary);
    color: #fff;
    border: none;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    font-size: 0.65rem;
    cursor: pointer;
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

  .digest-setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
  }

  .digest-label {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .digest-options {
    display: flex;
    gap: 0.25rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 0.15rem;
  }

  .digest-btn {
    background: none;
    border: none;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .digest-btn.active {
    background: var(--color-primary);
    color: #fff;
  }

  .digest-btn.locked {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .digest-pro-badge {
    font-size: 0.55rem;
    background: var(--color-degraded);
    color: #000;
    padding: 0.05rem 0.2rem;
    border-radius: 2px;
    font-weight: 700;
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

  .btn-cancel-sm {
    background: none;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .confirm-revoke {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--color-down);
    font-weight: 500;
  }

  .key-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .key-display code {
    flex: 1;
    font-size: 0.9rem;
    word-break: break-all;
    color: var(--color-operational);
  }

  .btn-copy {
    background: var(--color-operational);
    color: #fff;
    border: none;
    padding: 0.35rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .btn-copy:hover {
    opacity: 0.9;
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
