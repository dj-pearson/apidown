<script>
  import { createClient } from '@supabase/supabase-js';
  import LatencyChart from '$lib/components/LatencyChart.svelte';
  import RegionBreakdown from '$lib/components/RegionBreakdown.svelte';
  import UptimeBar from '$lib/components/UptimeBar.svelte';

  let { data } = $props();
  let api = $state(data.api);
  let incidents = $state(data.incidents);
  let latencyData = $state(data.latencyData);

  // Report button state
  let reportSubmitting = $state(false);
  let reportMessage = $state('');

  // Subscribe form state
  let showSubscribe = $state(false);
  let subEmail = $state('');
  let subSubmitting = $state(false);
  let subMessage = $state('');

  const ingestUrl = data.ingestUrl;

  const statusColors = {
    operational: 'var(--color-operational)',
    degraded: 'var(--color-degraded)',
    down: 'var(--color-down)',
  };

  const statusLabels = {
    operational: 'Operational',
    degraded: 'Degraded',
    down: 'Down',
  };

  // Compute summary stats from latency data
  let avgP50 = $derived(
    latencyData.length > 0
      ? Math.round(latencyData.reduce((s, d) => s + (d.p50_ms || 0), 0) / latencyData.length)
      : 0
  );
  let avgP95 = $derived(
    latencyData.length > 0
      ? Math.round(latencyData.reduce((s, d) => s + (d.p95_ms || 0), 0) / latencyData.length)
      : 0
  );

  // Get unique regions from recent data
  let regions = $derived([...new Set(latencyData.map(d => d.region).filter(Boolean))]);

  // Real-time subscription
  $effect(() => {
    const url = data.supabaseUrl;
    const key = data.supabaseAnonKey;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const channel = supabase
      .channel(`api-detail-${api.slug}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'apis',
        filter: `id=eq.${api.id}`,
      }, (payload) => {
        api = { ...api, ...payload.new };
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  });

  function formatDate(iso) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  }

  async function reportIssue() {
    reportSubmitting = true;
    reportMessage = '';
    try {
      const res = await fetch(`${ingestUrl}/v1/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_slug: api.slug }),
      });
      const body = await res.json();
      if (res.ok) {
        reportMessage = 'Report submitted. Thank you!';
      } else {
        reportMessage = body.error || 'Failed to submit report.';
      }
    } catch {
      reportMessage = 'Network error. Try again later.';
    }
    reportSubmitting = false;
  }

  async function subscribe() {
    subSubmitting = true;
    subMessage = '';
    try {
      const res = await fetch(`${ingestUrl}/v1/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_slug: api.slug,
          channel: 'email',
          destination: subEmail,
        }),
      });
      const body = await res.json();
      if (res.ok) {
        subMessage = body.status === 'already_subscribed'
          ? 'You are already subscribed.'
          : 'Subscribed! You will receive alerts for this API.';
        subEmail = '';
      } else {
        subMessage = body.error || 'Failed to subscribe.';
      }
    } catch {
      subMessage = 'Network error. Try again later.';
    }
    subSubmitting = false;
  }
</script>

<svelte:head>
  <title>{api.name} Status — Is {api.name} Down Right Now? | APIdown.net</title>
  <meta name="description" content="Real-time {api.name} API status — uptime, latency, and incident history from crowd-sourced production traffic." />
</svelte:head>

<a href="/" class="back">&larr; All APIs</a>

<div class="api-header">
  <div class="api-info">
    {#if api.logo_url}
      <img src={api.logo_url} alt="{api.name}" class="logo" />
    {/if}
    <div>
      <h1>{api.name}</h1>
      <span class="category">{api.category}</span>
    </div>
  </div>
  <div class="status-badge" style="background: {statusColors[api.current_status]}">
    {statusLabels[api.current_status]}
  </div>
</div>

<div class="metrics">
  <div class="metric">
    <span class="metric-value">{data.uptimePercent}%</span>
    <span class="metric-label">90-day uptime</span>
  </div>
  <div class="metric">
    <span class="metric-value">{avgP50}ms</span>
    <span class="metric-label">P50 latency</span>
  </div>
  <div class="metric">
    <span class="metric-value">{avgP95}ms</span>
    <span class="metric-label">P95 latency</span>
  </div>
  <div class="metric">
    <span class="metric-value">{regions.length || '—'}</span>
    <span class="metric-label">Regions reporting</span>
  </div>
</div>

<UptimeBar data={data.dailyUptime} />

<section class="latency-section">
  <h2>24-Hour Latency</h2>
  <LatencyChart data={latencyData} />
</section>

<RegionBreakdown data={latencyData} />

{#if api.status_page}
  <p class="vendor-link">Vendor status page: <a href={api.status_page} target="_blank" rel="noopener">{api.status_page}</a></p>
{/if}

<p class="sla-link">
  <a href="/api-status/{api.slug}/sla" target="_blank">Download SLA Report (JSON)</a>
</p>

<div class="actions-row">
  <div class="action-card">
    <h3>Report an Issue</h3>
    <p>Seeing problems with {api.name}? Submit a manual report to help the community.</p>
    <button onclick={reportIssue} disabled={reportSubmitting}>
      {reportSubmitting ? 'Submitting...' : 'Report Issue'}
    </button>
    {#if reportMessage}
      <p class="action-message">{reportMessage}</p>
    {/if}
  </div>

  <div class="action-card">
    <h3>Get Alerts</h3>
    <p>Receive email notifications when {api.name} status changes.</p>
    {#if !showSubscribe}
      <button onclick={() => showSubscribe = true}>Subscribe</button>
    {:else}
      <form onsubmit={(e) => { e.preventDefault(); subscribe(); }}>
        <input
          type="email"
          placeholder="you@example.com"
          bind:value={subEmail}
          required
        />
        <button type="submit" disabled={subSubmitting}>
          {subSubmitting ? 'Subscribing...' : 'Subscribe'}
        </button>
      </form>
    {/if}
    {#if subMessage}
      <p class="action-message">{subMessage}</p>
    {/if}
  </div>
</div>

<section class="incidents">
  <h2>Incident History</h2>
  {#if incidents.length === 0}
    <p class="empty">No incidents recorded. Looking good!</p>
  {:else}
    {#each incidents as incident (incident.id)}
      <a href="/incidents/{incident.id}" class="incident-row">
        <div class="incident-meta">
          <span class="severity severity-{incident.severity}">{incident.severity}</span>
          <span class="incident-status">{incident.status}</span>
        </div>
        <span class="incident-title">{incident.title}</span>
        {#if incident.report_count > 0}
          <span class="incident-reports">{incident.report_count} reports</span>
        {/if}
        <span class="incident-date">{formatDate(incident.started_at)}</span>
      </a>
    {/each}
  {/if}
</section>

<style>
  .back {
    display: inline-block;
    margin-bottom: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .api-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .api-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .logo {
    width: 48px;
    height: 48px;
    border-radius: 8px;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .category {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    text-transform: capitalize;
  }

  .status-badge {
    padding: 0.4rem 1rem;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.85rem;
    color: #000;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .metric {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1rem;
    text-align: center;
  }

  .metric-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .metric-label {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .latency-section {
    margin-bottom: 2rem;
  }

  .latency-section h2 {
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }

  .vendor-link {
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .sla-link {
    margin-bottom: 2rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .actions-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .action-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1.25rem;
  }

  .action-card h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 0.35rem;
  }

  .action-card p {
    font-size: 0.82rem;
    color: var(--color-text-muted);
    margin-bottom: 0.75rem;
  }

  .action-card button {
    background: var(--color-primary);
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: opacity 0.15s;
  }

  .action-card button:hover { opacity: 0.85; }
  .action-card button:disabled { opacity: 0.5; cursor: not-allowed; }

  .action-card form {
    display: flex;
    gap: 0.5rem;
  }

  .action-card input[type="email"] {
    flex: 1;
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.85rem;
    outline: none;
  }

  .action-card input[type="email"]:focus {
    border-color: var(--color-primary);
  }

  .action-message {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--color-operational);
  }

  @media (max-width: 640px) {
    .actions-row { grid-template-columns: 1fr; }
  }

  .incidents h2 {
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }

  .empty {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .incident-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    margin-bottom: 0.5rem;
    text-decoration: none;
    transition: border-color 0.15s;
  }

  .incident-row:hover {
    border-color: var(--color-primary);
    text-decoration: none;
  }

  .incident-meta {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .severity {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .severity-minor { background: var(--color-degraded); color: #000; }
  .severity-major { background: #f97316; color: #000; }
  .severity-critical { background: var(--color-down); color: #fff; }

  .incident-status {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-transform: capitalize;
  }

  .incident-title {
    flex: 1;
    color: var(--color-text);
    font-size: 0.9rem;
  }

  .incident-date {
    color: var(--color-text-muted);
    font-size: 0.8rem;
    flex-shrink: 0;
  }
</style>
