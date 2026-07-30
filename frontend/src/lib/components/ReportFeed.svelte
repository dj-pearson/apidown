<script>
  /**
   * "I'm seeing this too" — a live count of other people reporting the same API
   * right now, plus a one-click way to add your own. These are unverified user
   * reports, kept visually distinct from measured signals.
   */
  let {
    apiSlug,
    apiName,
    reportsLastHour = 0,
    reportTrend = [],
    recentReports = [],
  } = $props();

  const ERROR_TYPES = [
    { value: 'timeout', label: 'Timeouts' },
    { value: 'server_error', label: '5xx errors' },
    { value: 'auth_error', label: 'Auth failures' },
    { value: 'rate_limited', label: 'Rate limited' },
    { value: 'slow', label: 'Just slow' },
    { value: 'other', label: 'Something else' },
  ];

  const ERROR_LABELS = Object.fromEntries(ERROR_TYPES.map(t => [t.value, t.label]));

  // One report per browser per API per hour — this is a courtesy guard for the
  // UI only; the real limit is enforced server-side per IP hash.
  const storageKey = `apidown-reported-${apiSlug}`;

  let hourCount = $state(reportsLastHour);
  let reports = $state(recentReports);
  let trend = $state(reportTrend);
  let selectedType = $state('timeout');
  let submitting = $state(false);
  let message = $state('');
  let messageError = $state(false);
  let alreadyReported = $state(false);

  $effect(() => {
    try {
      const at = Number(localStorage.getItem(storageKey) || 0);
      alreadyReported = Date.now() - at < 60 * 60 * 1000;
    } catch {
      alreadyReported = false;
    }
  });

  let peak = $derived(Math.max(1, ...trend));

  function relative(iso) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  async function submit() {
    submitting = true;
    message = '';
    try {
      const res = await fetch(`/api/${apiSlug}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error_type: selectedType }),
      });
      const body = await res.json();

      if (!res.ok) {
        message = body.error || 'Could not record your report.';
        messageError = true;
      } else {
        hourCount = body.reports_last_hour ?? hourCount + 1;
        // Show it immediately rather than waiting for a reload.
        reports = [
          { id: `local-${Date.now()}`, created_at: new Date().toISOString(), error_type: selectedType, region: null },
          ...reports,
        ].slice(0, 25);
        trend = [...trend.slice(0, 23), trend[23] + 1];
        alreadyReported = true;
        message = 'Thanks — your report is counted.';
        messageError = false;
        try {
          localStorage.setItem(storageKey, String(Date.now()));
        } catch {
          // Storage unavailable; the server-side limit still applies.
        }
      }
    } catch {
      message = 'Could not reach APIdown. Please try again.';
      messageError = true;
    }
    submitting = false;
  }
</script>

<section class="reports" id="reports">
  <div class="reports-head">
    <div>
      <h2>Is anyone else seeing this?</h2>
      {#if hourCount > 0}
        <p class="count" aria-live="polite">
          <strong>{hourCount}</strong> {hourCount === 1 ? 'person has' : 'people have'} reported
          problems with {apiName} in the last hour.
        </p>
      {:else}
        <p class="count" aria-live="polite">
          No one has reported problems with {apiName} in the last hour. If you're hitting errors,
          you may be first.
        </p>
      {/if}
    </div>
  </div>

  <div class="report-form">
    <label for="report-type">What are you seeing?</label>
    <div class="report-row">
      <select id="report-type" bind:value={selectedType} disabled={submitting}>
        {#each ERROR_TYPES as t (t.value)}
          <option value={t.value}>{t.label}</option>
        {/each}
      </select>
      <button onclick={submit} disabled={submitting || alreadyReported}>
        {#if submitting}
          Submitting…
        {:else if alreadyReported}
          Report submitted
        {:else}
          I'm seeing this too
        {/if}
      </button>
    </div>
    {#if message}
      <p class="msg" class:msg-error={messageError} aria-live="polite">{message}</p>
    {/if}
  </div>

  {#if trend.some(v => v > 0)}
    <div class="trend">
      <span class="trend-label">Reports per hour, last 24h</span>
      <div class="bars" role="img" aria-label="Reports per hour over the last 24 hours. Peak {peak} in one hour, {trend.reduce((a, b) => a + b, 0)} in total.">
        {#each trend as count, i (i)}
          <span
            class="bar"
            class:bar-empty={count === 0}
            style="height: {count === 0 ? 2 : Math.max(8, (count / peak) * 100)}%"
            title="{count} report{count === 1 ? '' : 's'} · {24 - i}h ago"
          ></span>
        {/each}
      </div>
      <span class="trend-axis"><span>24h ago</span><span>now</span></span>
    </div>
  {/if}

  {#if reports.length > 0}
    <ul class="feed">
      {#each reports as r (r.id)}
        <li>
          <span class="feed-type">{ERROR_LABELS[r.error_type] || 'Unspecified'}</span>
          {#if r.region}
            <span class="feed-region">{r.region}</span>
          {/if}
          <time datetime={r.created_at}>{relative(r.created_at)}</time>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="caveat">
    These are <strong>unverified reports from visitors</strong>, not measurements. They're useful
    as corroboration — several reports in a quiet hour is a real signal — but the status,
    latency, and uptime figures elsewhere on this page come from the SDK's measured traffic and
    are independent of anything here. We store a salted hash for rate limiting and a country
    code; no IP addresses and no account needed.
  </p>
</section>

<style>
  .reports {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1.35rem;
    margin: 2rem 0;
  }

  .reports-head h2 {
    font-size: 1.05rem;
    margin-bottom: 0.4rem;
  }

  .count {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    line-height: 1.6;
    max-width: 620px;
  }

  .count strong {
    color: var(--color-text);
    font-size: 1rem;
  }

  .report-form {
    margin-top: 1.15rem;
  }

  .report-form label {
    display: block;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    margin-bottom: 0.4rem;
  }

  .report-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  select {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    border-radius: 6px;
    padding: 0.45rem 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
  }

  select:focus { border-color: var(--color-primary); }

  button {
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.45rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }

  button:hover:not(:disabled) { opacity: 0.9; }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .msg {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--color-operational);
  }

  .msg-error { color: var(--color-down); }

  .trend {
    margin-top: 1.35rem;
  }

  .trend-label {
    display: block;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    margin-bottom: 0.4rem;
  }

  .bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 48px;
  }

  .bar {
    flex: 1;
    background: var(--color-primary);
    border-radius: 2px 2px 0 0;
    min-height: 2px;
  }

  .bar-empty { background: var(--color-border); }

  .trend-axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.68rem;
    color: var(--color-text-muted);
    margin-top: 0.25rem;
  }

  .feed {
    list-style: none;
    padding: 0;
    margin-top: 1.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-height: 240px;
    overflow-y: auto;
  }

  .feed li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    padding: 0.35rem 0.5rem;
    background: var(--color-bg);
    border-radius: 6px;
  }

  .feed-type { color: var(--color-text); }

  .feed-region {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 0.05rem 0.3rem;
  }

  .feed li time {
    margin-left: auto;
    color: var(--color-text-muted);
    font-size: 0.72rem;
  }

  .caveat {
    margin-top: 1.35rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.78rem;
    color: var(--color-text-muted);
    line-height: 1.6;
    max-width: 720px;
  }

  .caveat strong { color: var(--color-text); }
</style>
