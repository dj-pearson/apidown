<script>
  import { createClient } from '@supabase/supabase-js';
  import { goto } from '$app/navigation';
  import { getTierLimits, getNextTier } from '$lib/tier-limits.js';
  import UpgradeModal from '$lib/components/UpgradeModal.svelte';

  let { data } = $props();
  let profile = $state(data.profile);
  let apiKeys = $state(data.apiKeys);
  let pinnedApis = $state(data.pinnedApis);
  let customApis = $state(data.customApis);
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

  // Custom API form state
  let showAddApi = $state(false);
  let customApiName = $state('');
  let customApiUrl = $state('');
  let customApiExpectedStatus = $state(200);
  let customAuthHeaderName = $state('');
  let customAuthHeaderValue = $state('');
  let showAuthFields = $state(false);
  let addingApi = $state(false);
  let confirmDeleteApiId = $state(null);

  // Status Pages state
  let statusPages = $state(data.statusPages || []);
  let statusPageApiMap = $state(data.statusPageApiMap || {});
  let allApis = $state(data.allApis || []);
  let subscriberCounts = $state(data.statusPageSubscriberCounts || {});
  let editingPageId = $state(null);
  let spSaving = $state(false);
  let spSaved = $state(false);
  let spError = $state('');
  let showCreatePage = $state(false);
  let copiedEmbed = $state(false);
  let copiedUrl = $state(false);

  // New page form state
  let newPageTitle = $state('');
  let newPageSlug = $state('');
  let newPageDescription = $state('');

  const isPro = $derived(tier === 'pro' || tier === 'team');

  async function createStatusPage() {
    const slug = newPageSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!slug || !newPageTitle.trim()) {
      spError = 'Title and slug are required.';
      return;
    }
    spSaving = true;
    spError = '';
    const supabase = getAuthClient();
    if (!supabase) { spSaving = false; return; }

    const { data: newPage, error: err } = await supabase
      .from('status_pages')
      .insert({
        user_id: data.profile.id,
        slug,
        title: newPageTitle.trim(),
        description: newPageDescription.trim(),
        is_enabled: false,
      })
      .select()
      .single();

    if (err) {
      spError = err.message?.includes('unique') || err.message?.includes('duplicate')
        ? 'That slug is already taken.'
        : 'Failed to create. ' + (err.message || '');
    } else {
      statusPages = [...statusPages, newPage];
      statusPageApiMap[newPage.id] = [];
      subscriberCounts[newPage.id] = 0;
      showCreatePage = false;
      newPageTitle = '';
      newPageSlug = '';
      newPageDescription = '';
      editingPageId = newPage.id;
    }
    spSaving = false;
  }

  async function saveStatusPage(page) {
    spSaving = true;
    spError = '';
    spSaved = false;
    const supabase = getAuthClient();
    if (!supabase) { spSaving = false; return; }

    const slug = page.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!slug) { spError = 'Slug is required.'; spSaving = false; return; }

    const { error: err } = await supabase
      .from('status_pages')
      .update({
        slug,
        title: page.title?.trim() || 'Status',
        description: page.description?.trim() || '',
        is_enabled: page.is_enabled,
        logo_url: page.logo_url || null,
        accent_color: page.accent_color || '#06b4d4',
        show_uptime_bars: page.show_uptime_bars ?? true,
        show_latency_chart: page.show_latency_chart ?? true,
        show_incidents: page.show_incidents ?? true,
        show_subscriber_form: page.show_subscriber_form ?? true,
        show_powered_by: page.show_powered_by ?? true,
        incidents_count: page.incidents_count || 5,
        uptime_days: page.uptime_days || 90,
      })
      .eq('id', page.id);

    if (err) {
      spError = err.message?.includes('unique') || err.message?.includes('duplicate')
        ? 'That slug is already taken.'
        : 'Failed to save. ' + (err.message || '');
    } else {
      statusPages = statusPages.map(sp => sp.id === page.id ? { ...sp, ...page, slug } : sp);
      spSaved = true;
      setTimeout(() => spSaved = false, 3000);
    }
    spSaving = false;
  }

  async function deleteStatusPage(pageId) {
    const supabase = getAuthClient();
    if (!supabase) return;
    const { error: err } = await supabase.from('status_pages').delete().eq('id', pageId);
    if (!err) {
      statusPages = statusPages.filter(sp => sp.id !== pageId);
      if (editingPageId === pageId) editingPageId = null;
    }
  }

  async function addApiToPage(pageId, apiId) {
    const supabase = getAuthClient();
    if (!supabase) return;
    const current = statusPageApiMap[pageId] || [];
    const order = current.length;
    const { error: err } = await supabase
      .from('status_page_apis')
      .insert({ status_page_id: pageId, api_id: apiId, display_order: order });
    if (!err) {
      statusPageApiMap[pageId] = [...current, { status_page_id: pageId, api_id: apiId, display_order: order }];
      statusPageApiMap = { ...statusPageApiMap };
    }
  }

  async function removeApiFromPage(pageId, apiId) {
    const supabase = getAuthClient();
    if (!supabase) return;
    const { error: err } = await supabase
      .from('status_page_apis')
      .delete()
      .eq('status_page_id', pageId)
      .eq('api_id', apiId);
    if (!err) {
      statusPageApiMap[pageId] = (statusPageApiMap[pageId] || []).filter(a => a.api_id !== apiId);
      statusPageApiMap = { ...statusPageApiMap };
    }
  }

  // 2FA / TOTP state
  let mfaEnabled = $state(data.profile.mfa_enabled || false);
  let showMfaSetup = $state(false);
  let mfaQrUrl = $state('');
  let mfaSecret = $state('');
  let mfaFactorId = $state('');
  let mfaVerifyCode = $state('');
  let mfaEnrolling = $state(false);
  let mfaVerifying = $state(false);
  let mfaError = $state('');
  let confirmDisableMfa = $state(false);
  let mfaDisabling = $state(false);

  const tier = $derived(profile.tier || 'free');
  const limits = $derived(getTierLimits(tier));
  const activeKeyCount = $derived(apiKeys.filter(k => k.is_active).length);
  const customApiCount = $derived(customApis.length);
  const subCount = $derived(subscriptions.length);
  const hasNextTier = $derived(getNextTier(tier) !== null);

  // Onboarding checklist state (US-088)
  let onboardingDismissed = $state(false);

  $effect(() => {
    if (typeof localStorage !== 'undefined') {
      onboardingDismissed = localStorage.getItem('apidown-onboarding-dismissed') === 'true';
    }
  });

  const onboardingSteps = $derived([
    { label: 'Create your first API key', href: '#api-keys', done: apiKeys.length > 0 },
    { label: 'Install the SDK', href: '/docs', done: false },
    { label: 'Subscribe to alerts', href: '/', done: subscriptions.length > 0 },
    { label: 'Pin APIs to My Stack', href: '/', done: pinnedApis.length > 0 },
  ]);

  const showOnboarding = $derived(
    !onboardingDismissed && apiKeys.length === 0 && subscriptions.length <= 1
  );

  function dismissOnboarding() {
    onboardingDismissed = true;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('apidown-onboarding-dismissed', 'true');
    }
  }

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

  async function addCustomApi() {
    if (customApiCount >= limits.customApis && hasNextTier) {
      upgradeLimitType = 'customApis';
      showUpgradeModal = true;
      return;
    }
    if (!customApiName.trim() || !customApiUrl.trim()) {
      alert('Name and URL are required.');
      return;
    }
    addingApi = true;
    try {
      const supabase = getAuthClient();
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : {};
      const token = sessionData?.session?.access_token;
      if (!token) {
        alert('Please log in again.');
        addingApi = false;
        return;
      }

      const res = await fetch(`${data.ingestUrl}/v1/custom-apis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: customApiName.trim(),
          url: customApiUrl.trim(),
          expected_status: customApiExpectedStatus,
          auth_header_name: customAuthHeaderName.trim() || undefined,
          auth_header_value: customAuthHeaderValue.trim() || undefined,
        }),
      });

      if (res.ok) {
        const api = await res.json();
        customApis = [api, ...customApis];
        customApiName = '';
        customApiUrl = '';
        customApiExpectedStatus = 200;
        customAuthHeaderName = '';
        customAuthHeaderValue = '';
        showAuthFields = false;
        showAddApi = false;
        // Reload to refresh pinned APIs too
        location.reload();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to add custom API');
      }
    } catch {
      alert('Something went wrong.');
    }
    addingApi = false;
  }

  async function deleteCustomApi(apiId) {
    try {
      const supabase = getAuthClient();
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : {};
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const res = await fetch(`${data.ingestUrl}/v1/custom-apis/${apiId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        customApis = customApis.filter(a => a.id !== apiId);
        pinnedApis = pinnedApis.filter(p => p.api_id !== apiId);
        confirmDeleteApiId = null;
      } else {
        alert('Failed to delete custom API');
      }
    } catch {
      alert('Something went wrong.');
    }
  }

  async function enrollMfa() {
    mfaEnrolling = true;
    mfaError = '';
    try {
      const supabase = getAuthClient();
      if (!supabase) return;
      const { data: enrollData, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'APIdown Authenticator',
      });
      if (error) {
        mfaError = error.message;
        mfaEnrolling = false;
        return;
      }
      mfaQrUrl = enrollData.totp.qr_code;
      mfaSecret = enrollData.totp.secret;
      mfaFactorId = enrollData.id;
      showMfaSetup = true;
    } catch {
      mfaError = 'Failed to start 2FA setup.';
    }
    mfaEnrolling = false;
  }

  async function verifyMfa() {
    mfaVerifying = true;
    mfaError = '';
    try {
      const supabase = getAuthClient();
      if (!supabase) return;

      // Challenge the factor
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeErr) {
        mfaError = challengeErr.message;
        mfaVerifying = false;
        return;
      }

      // Verify with the user's code
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaVerifyCode,
      });
      if (verifyErr) {
        mfaError = 'Invalid code. Please try again.';
        mfaVerifying = false;
        return;
      }

      // Mark MFA as enabled in our users table
      await supabase.from('users').update({ mfa_enabled: true }).eq('id', data.profile.id || '');
      mfaEnabled = true;
      showMfaSetup = false;
      mfaQrUrl = '';
      mfaSecret = '';
      mfaVerifyCode = '';
    } catch {
      mfaError = 'Verification failed.';
    }
    mfaVerifying = false;
  }

  async function disableMfa() {
    mfaDisabling = true;
    mfaError = '';
    try {
      const supabase = getAuthClient();
      if (!supabase) return;

      // List enrolled factors and unenroll them
      const { data: factorsList } = await supabase.auth.mfa.listFactors();
      const totpFactors = factorsList?.totp || [];
      for (const factor of totpFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      await supabase.from('users').update({ mfa_enabled: false }).eq('id', data.profile.id || '');
      mfaEnabled = false;
      confirmDisableMfa = false;
    } catch {
      mfaError = 'Failed to disable 2FA.';
    }
    mfaDisabling = false;
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

{#if showOnboarding}
  <div class="onboarding-card">
    <button class="onboarding-dismiss" onclick={dismissOnboarding} aria-label="Dismiss onboarding checklist">&times;</button>
    <h2 class="onboarding-title">Welcome to APIdown!</h2>
    <p class="onboarding-desc">Complete these steps to get the most out of your dashboard.</p>
    <ul class="onboarding-checklist">
      {#each onboardingSteps as step}
        <li class="onboarding-item" class:done={step.done}>
          <span class="onboarding-check">{step.done ? '\u2713' : ''}</span>
          <a href={step.href} class="onboarding-link">{step.label}</a>
        </li>
      {/each}
    </ul>
  </div>
{/if}

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
    {#if data.slaSummary && data.slaSummary.total > 0}
      <p class="stack-summary sla-summary-line">
        <a href="/sla" class="sla-link-inline">
          {#if data.slaSummary.passing === data.slaSummary.total}
            <span class="stack-ok">{data.slaSummary.passing}/{data.slaSummary.total} SLA targets met</span>
          {:else}
            <span class="stack-warn">{data.slaSummary.passing}/{data.slaSummary.total} SLA targets met</span>
          {/if}
        </a>
      </p>
    {/if}
  {/if}
</section>

<section class="section">
  <div class="section-header-row">
    <div>
      <h2>Custom APIs</h2>
      <p class="section-desc">Add your own API endpoints to monitor. Probed every 60 seconds from 3 regions.</p>
    </div>
    <span class="usage-count">{customApiCount}/{formatLimit(limits.customApis)}</span>
  </div>
  <div class="usage-bar">
    <div
      class="usage-fill"
      class:at-limit={customApiCount >= limits.customApis && limits.customApis !== Infinity}
      style="width: {usagePercent(customApiCount, limits.customApis)}%; background: {usageColor(customApiCount, limits.customApis)}"
    ></div>
  </div>

  {#if customApis.length > 0}
    <div class="custom-api-list">
      {#each customApis as api (api.id)}
        <div class="custom-api-row">
          <div class="custom-api-info">
            <a href="/api/{api.slug}" class="custom-api-name">{api.name}</a>
            <span class="custom-api-url">{api.probe_url}</span>
            {#if api.probe_auth_hint}
              <span class="custom-api-auth-hint">{api.probe_auth_hint}</span>
            {/if}
          </div>
          <div class="custom-api-meta">
            <span class="stack-status stack-status-{api.current_status}">{api.current_status}</span>
            <span class="custom-api-expect">expects {api.expected_status}</span>
            {#if confirmDeleteApiId === api.id}
              <span class="confirm-revoke">
                Sure?
                <button class="btn-danger-sm" onclick={() => deleteCustomApi(api.id)}>Yes, delete</button>
                <button class="btn-cancel-sm" onclick={() => confirmDeleteApiId = null}>Cancel</button>
              </span>
            {:else}
              <button class="btn-danger-sm" onclick={() => confirmDeleteApiId = api.id}>Delete</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if !showAddApi}
    <p class="empty">No custom APIs yet. Add one to start monitoring.</p>
  {/if}

  {#if showAddApi}
    <div class="add-api-form">
      <div class="add-api-field">
        <label for="custom-api-name">Name</label>
        <input id="custom-api-name" type="text" bind:value={customApiName} placeholder="e.g. My Claude API" />
        <span class="field-hint">A friendly name for this API in your dashboard.</span>
      </div>
      <div class="add-api-field">
        <label for="custom-api-url">Health Check URL</label>
        <input id="custom-api-url" type="url" bind:value={customApiUrl} placeholder="https://api.example.com/v1/health" />
        <span class="field-hint">The endpoint we'll ping every 60s. Use a health or status endpoint if available.</span>
      </div>
      <div class="add-api-field add-api-field-short">
        <label for="custom-api-status">Expected Status</label>
        <select id="custom-api-status" bind:value={customApiExpectedStatus}>
          <option value={200}>200 OK</option>
          <option value={201}>201 Created</option>
          <option value={204}>204 No Content</option>
          <option value={301}>301 Redirect</option>
          <option value={302}>302 Redirect</option>
        </select>
        <span class="field-hint">The HTTP status code that means "healthy." Usually 200.</span>
      </div>

      {#if !showAuthFields}
        <button class="btn-text" onclick={() => showAuthFields = true}>
          + Add authentication header (optional)
        </button>
      {:else}
        <div class="auth-fields">
          <div class="security-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>AES-256-GCM encrypted</span>
          </div>
          <p class="auth-notice">
            Your credentials are encrypted before they leave your browser's connection and stored as ciphertext.
            The plaintext is only decrypted server-side during health probes. It is never logged, cached, or exposed in API responses.
          </p>
          <div class="auth-fields-row">
            <div class="add-api-field">
              <label for="custom-auth-name">Header Name</label>
              <select id="custom-auth-name" bind:value={customAuthHeaderName}>
                <option value="">Select...</option>
                <option value="Authorization">Authorization</option>
                <option value="X-API-Key">X-API-Key</option>
                <option value="X-Auth-Token">X-Auth-Token</option>
              </select>
              <span class="field-hint">How does this API expect the key? Most use "Authorization."</span>
            </div>
            <div class="add-api-field add-api-field-grow">
              <label for="custom-auth-value">Header Value</label>
              <input id="custom-auth-value" type="password" bind:value={customAuthHeaderValue} placeholder="Bearer sk-ant-..." autocomplete="off" />
              <span class="field-hint">The full header value, e.g. "Bearer sk-ant-api03-..." or just the raw key.</span>
            </div>
          </div>
        </div>
      {/if}

      <div class="add-api-actions">
        <button class="btn-primary" onclick={addCustomApi} disabled={addingApi}>
          {addingApi ? 'Adding...' : 'Add API'}
        </button>
        <button class="btn-secondary" onclick={() => { showAddApi = false; customApiName = ''; customApiUrl = ''; customAuthHeaderName = ''; customAuthHeaderValue = ''; showAuthFields = false; }}>
          Cancel
        </button>
      </div>
    </div>
  {:else}
    <button class="btn-primary add-api-btn" onclick={() => showAddApi = true}>
      + Add Custom API
    </button>
  {/if}
</section>

<section class="section" id="api-keys">
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

{#if isPro}
<section class="section">
  <h2>Status Pages</h2>
  <p class="section-desc">Create public status pages showing your monitored APIs with uptime bars, latency charts, and incident history. {tier === 'pro' ? '1 page included' : 'Up to 3 pages'} on your {tier} plan.</p>

  <!-- Existing Status Pages -->
  {#each statusPages as page (page.id)}
    <div class="sp-card" class:sp-card-editing={editingPageId === page.id}>
      <div class="sp-card-header">
        <div class="sp-card-title-row">
          <span class="sp-status-dot" class:sp-dot-on={page.is_enabled} class:sp-dot-off={!page.is_enabled}></span>
          <strong>{page.title}</strong>
          <span class="sp-slug-badge">/status/{page.slug}</span>
          {#if subscriberCounts[page.id] > 0}
            <span class="sp-sub-count">{subscriberCounts[page.id]} subscriber{subscriberCounts[page.id] === 1 ? '' : 's'}</span>
          {/if}
        </div>
        <div class="sp-card-actions">
          {#if page.is_enabled}
            <a href="/status/{page.slug}" target="_blank" rel="noopener" class="btn-sm">View</a>
          {/if}
          <button class="btn-sm" onclick={() => editingPageId = editingPageId === page.id ? null : page.id}>
            {editingPageId === page.id ? 'Collapse' : 'Edit'}
          </button>
        </div>
      </div>

      {#if editingPageId === page.id}
        <div class="sp-edit-body">
          <!-- Basic Settings -->
          <div class="sp-edit-grid">
            <div class="status-field">
              <label>Enabled</label>
              <button
                class="toggle-btn"
                class:toggle-on={page.is_enabled}
                onclick={() => { page.is_enabled = !page.is_enabled; statusPages = [...statusPages]; }}
                role="switch"
                aria-checked={page.is_enabled}
              >
                <span class="toggle-knob"></span>
              </button>
            </div>

            <div class="status-field">
              <label>Title</label>
              <input type="text" bind:value={page.title} placeholder="My Status Page" maxlength="100" />
            </div>

            <div class="status-field">
              <label>Description</label>
              <input type="text" bind:value={page.description} placeholder="Current status of our dependencies" maxlength="200" />
            </div>

            <div class="status-field">
              <label>URL Slug</label>
              <div class="slug-input-row">
                <span class="slug-prefix">apidown.net/status/</span>
                <input type="text" bind:value={page.slug} placeholder="my-company" maxlength="60" />
              </div>
            </div>
          </div>

          <!-- Branding -->
          <h4 class="sp-sub-heading">Branding</h4>
          <div class="sp-edit-grid">
            <div class="status-field">
              <label>Logo URL</label>
              <input type="url" bind:value={page.logo_url} placeholder="https://example.com/logo.png" />
            </div>

            <div class="status-field">
              <label>Accent Color</label>
              <div class="color-input-row">
                <input type="color" bind:value={page.accent_color} class="color-picker" />
                <input type="text" bind:value={page.accent_color} placeholder="#06b4d4" maxlength="7" class="color-text" />
              </div>
            </div>

            <div class="status-field">
              <label>Show "Powered by APIdown"</label>
              <button
                class="toggle-btn"
                class:toggle-on={page.show_powered_by}
                onclick={() => { page.show_powered_by = !page.show_powered_by; statusPages = [...statusPages]; }}
                role="switch"
                aria-checked={page.show_powered_by}
              >
                <span class="toggle-knob"></span>
              </button>
              {#if page.show_powered_by === false && tier !== 'team'}
                <span class="field-hint" style="color: var(--color-degraded)">White-label requires Team plan</span>
              {/if}
            </div>
          </div>

          <!-- Components -->
          <h4 class="sp-sub-heading">Components</h4>
          <div class="sp-toggles-row">
            {#each [
              { key: 'show_uptime_bars', label: 'Uptime Bars' },
              { key: 'show_latency_chart', label: 'Latency Charts' },
              { key: 'show_incidents', label: 'Incidents' },
              { key: 'show_subscriber_form', label: 'Subscribe Form' },
            ] as toggle}
              <label class="sp-toggle-item">
                <input type="checkbox" bind:checked={page[toggle.key]} />
                <span>{toggle.label}</span>
              </label>
            {/each}
          </div>

          <!-- APIs on this page -->
          <h4 class="sp-sub-heading">APIs on this page</h4>
          <div class="sp-api-list">
            {#each (statusPageApiMap[page.id] || []) as spa}
              {@const apiInfo = allApis.find(a => a.id === spa.api_id)}
              {#if apiInfo}
                <div class="sp-api-chip">
                  {#if apiInfo.logo_url}
                    <img src={apiInfo.logo_url} alt="" width="16" height="16" class="sp-api-chip-logo" />
                  {/if}
                  <span>{apiInfo.name}</span>
                  <button class="sp-api-chip-remove" onclick={() => removeApiFromPage(page.id, spa.api_id)} aria-label="Remove {apiInfo.name}">&times;</button>
                </div>
              {/if}
            {/each}
          </div>

          <div class="sp-add-api-row">
            <select class="sp-api-select" onchange={(e) => { if (e.target.value) { addApiToPage(page.id, e.target.value); e.target.value = ''; } }}>
              <option value="">+ Add API...</option>
              {#each allApis.filter(a => !(statusPageApiMap[page.id] || []).some(spa => spa.api_id === a.id)) as api}
                <option value={api.id}>{api.name}</option>
              {/each}
            </select>
          </div>

          <!-- Embed Info -->
          {#if page.is_enabled && page.slug}
            {@const pUrl = `https://apidown.net/status/${page.slug}`}
            {@const embed = `<iframe src="${pUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;"></iframe>`}
            <div class="status-embed-info">
              <div class="status-url-row">
                <label>Public URL</label>
                <div class="status-url-display">
                  <a href={pUrl} target="_blank" rel="noopener">{pUrl}</a>
                  <button class="btn-copy-sm" onclick={() => { navigator.clipboard.writeText(pUrl); copiedUrl = true; setTimeout(() => copiedUrl = false, 2000); }}>
                    {copiedUrl ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div class="status-url-row">
                <label>Embed Snippet</label>
                <div class="embed-code-wrap">
                  <code class="embed-code">{embed}</code>
                  <button class="btn-copy-sm" onclick={() => { navigator.clipboard.writeText(embed); copiedEmbed = true; setTimeout(() => copiedEmbed = false, 2000); }}>
                    {copiedEmbed ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          {/if}

          <!-- Save / Delete -->
          <div class="sp-edit-actions">
            <button class="btn-primary" onclick={() => saveStatusPage(page)} disabled={spSaving}>
              {spSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button class="btn-danger-sm" onclick={() => { if (confirm('Delete this status page? This cannot be undone.')) deleteStatusPage(page.id); }}>
              Delete Page
            </button>
            {#if spSaved}<span class="status-saved-msg">Saved!</span>{/if}
            {#if spError}<span class="status-error-msg">{spError}</span>{/if}
          </div>
        </div>
      {/if}
    </div>
  {/each}

  <!-- Create New Page -->
  {#if statusPages.length < limits.statusPages}
    {#if showCreatePage}
      <div class="sp-create-form">
        <div class="status-field">
          <label>Title</label>
          <input type="text" bind:value={newPageTitle} placeholder="My Status Page" maxlength="100" />
        </div>
        <div class="status-field">
          <label>URL Slug</label>
          <div class="slug-input-row">
            <span class="slug-prefix">apidown.net/status/</span>
            <input type="text" bind:value={newPageSlug} placeholder="my-company" maxlength="60" />
          </div>
        </div>
        <div class="status-field">
          <label>Description (optional)</label>
          <input type="text" bind:value={newPageDescription} placeholder="Live status of our API dependencies" maxlength="200" />
        </div>
        <div class="sp-create-actions">
          <button class="btn-primary" onclick={createStatusPage} disabled={spSaving}>
            {spSaving ? 'Creating...' : 'Create Page'}
          </button>
          <button class="btn-sm" onclick={() => showCreatePage = false}>Cancel</button>
          {#if spError}<span class="status-error-msg">{spError}</span>{/if}
        </div>
      </div>
    {:else}
      <button class="btn-add-page" onclick={() => { showCreatePage = true; spError = ''; }}>
        + Create Status Page
      </button>
    {/if}
  {:else if statusPages.length > 0}
    <p class="sp-limit-msg">You've reached the status page limit for your {tier} plan. {#if tier === 'pro'}Upgrade to Team for up to 3 pages.{/if}</p>
  {/if}
</section>
{/if}

<section class="section">
  <h2>Security</h2>
  <p class="section-desc">Protect your account and stored API credentials.</p>

  <div class="security-cards">
    <div class="security-card">
      <div class="security-card-header">
        <div class="security-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <h3>Encryption at Rest</h3>
          <p class="security-card-desc">All stored API credentials are encrypted with AES-256-GCM. Keys are decrypted only during server-side health probes and are never logged, cached, or returned in responses.</p>
        </div>
      </div>
      <span class="security-status security-status-active">Active</span>
    </div>

    <div class="security-card">
      <div class="security-card-header">
        <div class="security-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <div>
          <h3>Two-Factor Authentication (2FA)</h3>
          <p class="security-card-desc">
            {#if mfaEnabled}
              Your account is protected with TOTP-based 2FA. A code from your authenticator app is required at each login.
            {:else}
              Add an extra layer of security by requiring a time-based one-time password (TOTP) from an authenticator app like Google Authenticator, Authy, or 1Password.
            {/if}
          </p>
        </div>
      </div>
      {#if mfaEnabled}
        <span class="security-status security-status-active">Enabled</span>
      {:else}
        <span class="security-status security-status-inactive">Not enabled</span>
      {/if}
    </div>
  </div>

  {#if mfaError}
    <p class="mfa-error">{mfaError}</p>
  {/if}

  {#if !mfaEnabled && !showMfaSetup}
    <button class="btn-primary mfa-btn" onclick={enrollMfa} disabled={mfaEnrolling}>
      {mfaEnrolling ? 'Setting up...' : 'Enable 2FA'}
    </button>
  {/if}

  {#if showMfaSetup}
    <div class="mfa-setup">
      <h3>Set up your authenticator</h3>
      <ol class="mfa-steps">
        <li>Open your authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
        <li>Scan the QR code below, or manually enter the secret key</li>
        <li>Enter the 6-digit code from your app to verify</li>
      </ol>

      <div class="mfa-qr-area">
        {#if mfaQrUrl}
          <img src={mfaQrUrl} alt="Scan this QR code with your authenticator app" class="mfa-qr" />
        {/if}
        <div class="mfa-secret-area">
          <span class="mfa-secret-label">Manual entry key:</span>
          <code class="mfa-secret">{mfaSecret}</code>
        </div>
      </div>

      <div class="mfa-verify-row">
        <input
          type="text"
          bind:value={mfaVerifyCode}
          placeholder="6-digit code"
          maxlength="6"
          pattern="[0-9]*"
          inputmode="numeric"
          autocomplete="one-time-code"
          class="mfa-code-input"
        />
        <button class="btn-primary" onclick={verifyMfa} disabled={mfaVerifying || mfaVerifyCode.length !== 6}>
          {mfaVerifying ? 'Verifying...' : 'Verify & Enable'}
        </button>
        <button class="btn-secondary" onclick={() => { showMfaSetup = false; mfaError = ''; }}>
          Cancel
        </button>
      </div>
    </div>
  {/if}

  {#if mfaEnabled}
    <div class="mfa-enabled-actions">
      {#if confirmDisableMfa}
        <p class="mfa-disable-warn">Disabling 2FA will remove the extra layer of protection. Are you sure?</p>
        <div class="mfa-disable-btns">
          <button class="btn-danger-sm" onclick={disableMfa} disabled={mfaDisabling}>
            {mfaDisabling ? 'Disabling...' : 'Yes, disable 2FA'}
          </button>
          <button class="btn-cancel-sm" onclick={() => confirmDisableMfa = false}>Cancel</button>
        </div>
      {:else}
        <button class="btn-text mfa-disable-link" onclick={() => confirmDisableMfa = true}>
          Disable 2FA
        </button>
      {/if}
    </div>
  {/if}
</section>

<UpgradeModal
  bind:show={showUpgradeModal}
  currentTier={tier}
  limitType={upgradeLimitType}
  currentUsage={upgradeLimitType === 'apiKeys' ? activeKeyCount : upgradeLimitType === 'customApis' ? customApiCount : subCount}
  maxUsage={upgradeLimitType === 'apiKeys' ? formatLimit(limits.apiKeys) : upgradeLimitType === 'customApis' ? formatLimit(limits.customApis) : formatLimit(limits.subscriptions)}
/>

<style>
  /* Onboarding checklist (US-088) */
  .onboarding-card {
    position: relative;
    background: var(--card-bg, #1e1e2e);
    border: 1px solid var(--border, #2e2e3e);
    border-radius: 12px;
    padding: 1.5rem 2rem;
    margin-bottom: 2rem;
  }

  .onboarding-dismiss {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: none;
    border: none;
    color: var(--text-muted, #888);
    font-size: 1.25rem;
    cursor: pointer;
    line-height: 1;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .onboarding-dismiss:hover {
    color: var(--text, #eee);
    background: var(--hover-bg, rgba(255,255,255,0.06));
  }

  .onboarding-title {
    font-size: 1.15rem;
    font-weight: 600;
    margin: 0 0 0.25rem;
    color: var(--text, #eee);
  }

  .onboarding-desc {
    color: var(--text-muted, #999);
    font-size: 0.9rem;
    margin: 0 0 1rem;
  }

  .onboarding-checklist {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .onboarding-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .onboarding-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    border: 2px solid var(--border, #444);
    font-size: 0.8rem;
    flex-shrink: 0;
    color: var(--text-muted, #888);
  }

  .onboarding-item.done .onboarding-check {
    background: var(--accent, #4ade80);
    border-color: var(--accent, #4ade80);
    color: #000;
  }

  .onboarding-link {
    color: var(--link, #60a5fa);
    text-decoration: none;
    font-size: 0.95rem;
  }

  .onboarding-link:hover {
    text-decoration: underline;
  }

  .onboarding-item.done .onboarding-link {
    color: var(--text-muted, #888);
    text-decoration: line-through;
  }

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

  .sla-summary-line { margin-top: 0.25rem; }
  .sla-link-inline { text-decoration: none; }
  .sla-link-inline:hover { text-decoration: underline; }

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

  .btn-sm {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    padding: 0.3rem 0.6rem;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 500;
    text-decoration: none;
  }

  .btn-sm:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

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

  .custom-api-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .custom-api-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .custom-api-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .custom-api-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--color-text);
    text-decoration: none;
  }

  .custom-api-name:hover {
    color: var(--color-primary);
  }

  .custom-api-url {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono, monospace);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 400px;
  }

  .custom-api-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .custom-api-expect {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .add-api-btn {
    margin-top: 0.5rem;
  }

  .add-api-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .add-api-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .add-api-field label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .add-api-field input,
  .add-api-field select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.85rem;
  }

  .add-api-field-short {
    max-width: 200px;
  }

  .add-api-field-grow {
    flex: 1;
  }

  .add-api-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .btn-text:hover {
    color: var(--color-primary);
  }

  .auth-fields {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 0.75rem;
    background: var(--color-bg);
  }

  .auth-notice {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  .auth-fields-row {
    display: flex;
    gap: 0.5rem;
  }

  .custom-api-auth-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono, monospace);
    opacity: 0.7;
  }

  .field-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    opacity: 0.7;
    line-height: 1.3;
  }

  .security-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-operational);
    margin-bottom: 0.35rem;
  }

  .security-cards {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .security-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .security-card-header {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .security-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text-muted);
  }

  .security-card h3 {
    font-size: 0.9rem;
    margin: 0 0 0.2rem;
  }

  .security-card-desc {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    line-height: 1.4;
    margin: 0;
  }

  .security-status {
    flex-shrink: 0;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 10px;
    white-space: nowrap;
  }

  .security-status-active {
    background: rgba(74, 222, 128, 0.15);
    color: var(--color-operational);
  }

  .security-status-inactive {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-degraded);
  }

  .mfa-btn {
    margin-bottom: 1rem;
  }

  .mfa-error {
    color: var(--color-down);
    font-size: 0.85rem;
    margin-bottom: 0.75rem;
  }

  .mfa-setup {
    padding: 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .mfa-setup h3 {
    font-size: 1rem;
    margin: 0 0 0.75rem;
  }

  .mfa-steps {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    padding-left: 1.25rem;
    margin: 0 0 1rem;
    line-height: 1.6;
  }

  .mfa-qr-area {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .mfa-qr {
    width: 160px;
    height: 160px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
  }

  .mfa-secret-area {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .mfa-secret-label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .mfa-secret {
    font-size: 0.8rem;
    color: var(--color-text);
    word-break: break-all;
    background: var(--color-bg);
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    border: 1px solid var(--color-border);
  }

  .mfa-verify-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .mfa-code-input {
    width: 120px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 1rem;
    font-family: var(--font-mono, monospace);
    letter-spacing: 0.15em;
    text-align: center;
  }

  .mfa-enabled-actions {
    margin-top: 0.5rem;
  }

  .mfa-disable-warn {
    font-size: 0.85rem;
    color: var(--color-down);
    margin-bottom: 0.5rem;
  }

  .mfa-disable-btns {
    display: flex;
    gap: 0.5rem;
  }

  .mfa-disable-link {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  @media (max-width: 640px) {
    .dashboard-header { flex-direction: column; gap: 0.75rem; }
    .key-row { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
    .key-meta { flex-wrap: wrap; }
    .create-key { flex-direction: column; }
    .create-key input { max-width: 100%; }
    .custom-api-row { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
    .custom-api-url { max-width: 100%; }
    .custom-api-meta { flex-wrap: wrap; }
    .add-api-field-short { max-width: 100%; }
    .auth-fields-row { flex-direction: column; }
    .security-card { flex-direction: column; }
    .mfa-qr-area { flex-direction: column; align-items: flex-start; }
    .mfa-verify-row { flex-direction: column; align-items: stretch; }
    .mfa-code-input { width: 100%; }
    .slug-input-row { flex-direction: column; }
    .slug-prefix { margin-bottom: 0.25rem; }
    .embed-code { font-size: 0.65rem; }
  }

  /* Status Pages */
  .sp-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    margin-bottom: 0.75rem;
    overflow: hidden;
  }

  .sp-card-editing {
    border-color: var(--color-primary);
  }

  .sp-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    gap: 0.75rem;
  }

  .sp-card-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .sp-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .sp-dot-on { background: var(--color-operational, #4ade80); }
  .sp-dot-off { background: var(--color-text-muted); opacity: 0.4; }

  .sp-slug-badge {
    font-size: 0.7rem;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted);
    background: var(--color-bg);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .sp-sub-count {
    font-size: 0.7rem;
    color: var(--color-primary);
    font-weight: 500;
  }

  .sp-card-actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .sp-edit-body {
    padding: 0 1rem 1rem;
    border-top: 1px solid var(--color-border);
  }

  .sp-edit-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .sp-sub-heading {
    font-size: 0.85rem;
    font-weight: 600;
    margin-top: 1.25rem;
    margin-bottom: 0;
    color: var(--color-text);
  }

  .color-input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .color-picker {
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    padding: 2px;
    background: transparent;
  }

  .color-text {
    width: 90px;
  }

  .sp-toggles-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.25rem;
    margin-top: 0.5rem;
  }

  .sp-toggle-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .sp-toggle-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--color-primary);
  }

  .sp-api-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }

  .sp-api-chip {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
  }

  .sp-api-chip-logo {
    width: 16px;
    height: 16px;
    border-radius: 3px;
  }

  .sp-api-chip-remove {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1rem;
    padding: 0 0.15rem;
    line-height: 1;
  }

  .sp-api-chip-remove:hover { color: var(--color-down); }

  .sp-add-api-row {
    margin-top: 0.5rem;
  }

  .sp-api-select {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.8rem;
    min-width: 200px;
  }

  .sp-edit-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .btn-danger-sm {
    background: transparent;
    border: 1px solid var(--color-down, #ef4444);
    color: var(--color-down, #ef4444);
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-danger-sm:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .sp-create-form {
    background: var(--color-surface);
    border: 1px solid var(--color-primary);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .sp-create-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .btn-add-page {
    width: 100%;
    padding: 0.75rem;
    background: transparent;
    border: 2px dashed var(--color-border);
    border-radius: 8px;
    color: var(--color-text-muted);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-add-page:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .sp-limit-msg {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    text-align: center;
    padding: 0.75rem;
  }

  .toggle-btn {
    position: relative;
    width: 44px;
    height: 24px;
    border-radius: 12px;
    border: none;
    background: var(--color-border, #555);
    cursor: pointer;
    padding: 0;
    transition: background 0.2s;
  }

  .toggle-btn.toggle-on {
    background: var(--color-operational, #4ade80);
  }

  .toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s;
  }

  .toggle-btn.toggle-on .toggle-knob {
    transform: translateX(20px);
  }

  .status-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .status-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .status-field label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .status-field input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.85rem;
  }

  .slug-input-row {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .slug-prefix {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono, monospace);
    white-space: nowrap;
    padding-right: 0.25rem;
  }

  .slug-input-row input {
    flex: 1;
  }

  .status-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .status-saved-msg {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-operational, #4ade80);
  }

  .status-error-msg {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-down, #ef4444);
  }

  .status-embed-info {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .status-url-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .status-url-row label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .status-url-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-url-display a {
    font-size: 0.85rem;
    color: var(--color-primary);
    word-break: break-all;
  }

  .btn-copy-sm {
    flex-shrink: 0;
    background: var(--color-primary);
    color: #fff;
    border: none;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-copy-sm:hover {
    opacity: 0.9;
  }

  .embed-code-wrap {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .embed-code {
    flex: 1;
    font-size: 0.75rem;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted);
    background: var(--color-bg);
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    word-break: break-all;
    line-height: 1.4;
  }
</style>
