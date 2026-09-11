<script>
  import SEO from '$lib/components/SEO.svelte';
  import { formatDuration } from '$lib/api-history.js';

  let { data } = $props();
  let api = $derived(data.api);
  let incidents = $derived(data.incidents);
  let monthLabel = $derived(data.monthLabel);

  function duration(inc) {
    const start = new Date(inc.started_at).getTime();
    const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now();
    return formatDuration(end - start);
  }

  let headline = $derived(
    incidents.length === 0
      ? `No ${api.name} outages recorded in ${monthLabel}`
      : `${incidents.length} ${api.name} ${incidents.length === 1 ? 'incident' : 'incidents'} in ${monthLabel}`
  );
</script>

<SEO
  title="{api.name} outages in {monthLabel} — incident log and uptime | APIdown.net"
  description={incidents.length === 0
    ? `We recorded no ${api.name} outages or degradations during ${monthLabel}. Measured uptime: ${data.uptimePct}%.`
    : `${incidents.length} recorded ${api.name} ${incidents.length === 1 ? 'incident' : 'incidents'} in ${monthLabel}, totalling ${formatDuration(data.downtimeMs)} of downtime. Measured uptime: ${data.uptimePct}%.`}
  canonical="https://apidown.net/api/{api.slug}/history/{data.month}"
  schema={{
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${api.name} incidents in ${monthLabel}`,
    url: `https://apidown.net/api/${api.slug}/history/${data.month}`,
    numberOfItems: incidents.length,
    itemListElement: incidents.map((inc, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: inc.title,
      url: `https://apidown.net/incidents/${inc.id}`,
    })),
  }}
/>

<nav class="crumbs" aria-label="Breadcrumb">
  <a href="/">Status</a>
  <span aria-hidden="true">/</span>
  <a href="/api/{api.slug}">{api.name}</a>
  <span aria-hidden="true">/</span>
  <a href="/api/{api.slug}/history">History</a>
  <span aria-hidden="true">/</span>
  <span>{monthLabel}</span>
</nav>

<h1>{headline}</h1>
<p class="sub">
  {#if data.isCurrentMonth}
    {monthLabel} is still in progress — figures cover the month so far.
  {/if}
  Measured from crowd-sourced client-side traffic, not {api.name}'s own reporting.
</p>

<div class="summary">
  <div class="stat">
    <span class="stat-value">{data.uptimePct === null ? '—' : `${data.uptimePct}%`}</span>
    <span class="stat-label">Measured uptime</span>
  </div>
  <div class="stat">
    <span class="stat-value">{formatDuration(data.downtimeMs)}</span>
    <span class="stat-label">Total downtime</span>
  </div>
  <div class="stat">
    <span class="stat-value">{formatDuration(data.longestOutageMs)}</span>
    <span class="stat-label">Longest single outage</span>
  </div>
  <div class="stat">
    <span class="stat-value">{incidents.length}</span>
    <span class="stat-label">Incidents</span>
  </div>
</div>

{#if incidents.length === 0}
  <div class="clean">
    <strong>A clean month.</strong>
    <p>
      We recorded no {api.name} outages or degradations in {monthLabel}. That's measured from the
      traffic our SDK saw — a short blip affecting only one region may not have crossed our
      detection threshold.
    </p>
  </div>
{:else}
  <ol class="incidents">
    {#each incidents as inc (inc.id)}
      <li>
        <div class="inc-top">
          <span class="sev sev-{inc.severity}">{inc.severity}</span>
          <a href="/incidents/{inc.id}" class="inc-title">{inc.title}</a>
          <span class="inc-dur">{duration(inc)}</span>
        </div>
        <div class="inc-meta">
          <time datetime={inc.started_at}>
            Started {new Date(inc.started_at).toUTCString()}
          </time>
          {#if inc.resolved_at}
            <time datetime={inc.resolved_at}>
              · Resolved {new Date(inc.resolved_at).toUTCString()}
            </time>
          {:else}
            <span class="ongoing">· Still open</span>
          {/if}
        </div>
      </li>
    {/each}
  </ol>
{/if}

<nav class="month-nav" aria-label="Month navigation">
  <a href="/api/{api.slug}/history/{data.prevMonth}">← Previous month</a>
  <a href="/api/{api.slug}/history">All months</a>
  {#if data.nextMonth}
    <a href="/api/{api.slug}/history/{data.nextMonth}">Next month →</a>
  {:else}
    <span class="disabled">Next month →</span>
  {/if}
</nav>

<style>
  .crumbs {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 1rem;
  }

  .crumbs a { color: var(--color-text-muted); }
  .crumbs a:hover { color: var(--color-primary); }

  h1 {
    font-size: 1.6rem;
    margin-bottom: 0.5rem;
    line-height: 1.3;
  }

  .sub {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    max-width: 640px;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.75rem;
  }

  .stat {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.9rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .stat-value {
    font-size: 1.4rem;
    font-weight: 700;
    font-family: var(--font-mono);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  .clean {
    background: var(--color-surface);
    border: 1px solid color-mix(in srgb, var(--color-operational) 35%, var(--color-border));
    border-radius: 10px;
    padding: 1.25rem;
  }

  .clean strong { display: block; margin-bottom: 0.4rem; }

  .clean p {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    line-height: 1.6;
    max-width: 620px;
  }

  .incidents {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .incidents li {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.85rem 1rem;
  }

  .inc-top {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-bottom: 0.3rem;
  }

  .inc-title {
    flex: 1;
    font-size: 0.925rem;
    color: var(--color-text);
  }

  .inc-title:hover { color: var(--color-primary); }

  .inc-dur {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .inc-meta {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .ongoing { color: var(--color-degraded); }

  .sev {
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.12rem 0.4rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .sev-critical { background: rgba(239, 68, 68, 0.15); color: var(--color-down); }
  .sev-major { background: rgba(245, 158, 11, 0.15); color: var(--color-degraded); }
  .sev-minor { background: rgba(148, 163, 184, 0.15); color: var(--color-text-muted); }

  .month-nav {
    display: flex;
    gap: 1.25rem;
    margin-top: 2rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.85rem;
    flex-wrap: wrap;
  }

  .month-nav .disabled {
    color: var(--color-text-muted);
    opacity: 0.45;
  }
</style>
