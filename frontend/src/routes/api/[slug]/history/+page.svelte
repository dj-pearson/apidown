<script>
  import SEO from '$lib/components/SEO.svelte';
  import { formatDuration } from '$lib/api-history.js';

  let { data } = $props();

  let api = $derived(data.api);
  let months = $derived(data.months);

  let monthsWithData = $derived(months.filter(m => m.uptimePct !== null));

  function uptimeClass(pct) {
    if (pct === null) return 'na';
    if (pct >= 99.9) return 'good';
    if (pct >= 99) return 'ok';
    return 'bad';
  }
</script>

<SEO
  title="{api.name} outage history — monthly uptime and past incidents | APIdown.net"
  description="Every recorded {api.name} outage and degradation, month by month, with measured uptime and downtime totals from crowd-sourced production traffic."
  canonical="https://apidown.net/api/{api.slug}/history"
  schema={{
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${api.name} incident and uptime history`,
    description: `Monthly uptime and incident history for the ${api.name} API, measured from crowd-sourced client-side traffic.`,
    url: `https://apidown.net/api/${api.slug}/history`,
    creator: { '@type': 'Organization', name: 'APIdown.net', url: 'https://apidown.net' },
    isAccessibleForFree: true,
    temporalCoverage: monthsWithData.length
      ? `${monthsWithData[monthsWithData.length - 1].month}/${monthsWithData[0].month}`
      : undefined,
  }}
/>

<nav class="crumbs" aria-label="Breadcrumb">
  <a href="/">Status</a>
  <span aria-hidden="true">/</span>
  <a href="/api/{api.slug}">{api.name}</a>
  <span aria-hidden="true">/</span>
  <span>History</span>
</nav>

<h1>{api.name} outage history</h1>
<p class="sub">
  Every {api.name} incident we've recorded, grouped by month. Uptime is measured from
  crowd-sourced client-side traffic — it is our measurement, not {api.name}'s own.
</p>

<div class="summary">
  <div class="stat">
    <span class="stat-value">{data.uptime90d === null ? '—' : `${data.uptime90d}%`}</span>
    <span class="stat-label">Uptime, last 90 days</span>
  </div>
  <div class="stat">
    <span class="stat-value">{data.totalIncidents}</span>
    <span class="stat-label">Incidents in {data.windowMonths} months</span>
  </div>
  <div class="stat">
    <span class="stat-value">{monthsWithData.filter(m => m.incidentCount === 0).length}</span>
    <span class="stat-label">Clean months</span>
  </div>
</div>

<table>
  <caption class="sr-only">Monthly uptime and incident counts for {api.name}</caption>
  <thead>
    <tr>
      <th scope="col">Month</th>
      <th scope="col">Uptime</th>
      <th scope="col">Incidents</th>
      <th scope="col">Total downtime</th>
      <th scope="col">Longest outage</th>
    </tr>
  </thead>
  <tbody>
    {#each monthsWithData as m (m.month)}
      <tr>
        <th scope="row"><a href="/api/{api.slug}/history/{m.month}">{m.label}</a></th>
        <td class="uptime uptime-{uptimeClass(m.uptimePct)}">{m.uptimePct}%</td>
        <td>{m.incidentCount || '—'}</td>
        <td>{formatDuration(m.downtimeMs)}</td>
        <td>{formatDuration(m.longestOutageMs)}</td>
      </tr>
    {/each}
  </tbody>
</table>

<p class="foot">
  Looking for the live picture? See <a href="/api/{api.slug}">{api.name} current status</a>,
  the <a href="/api/{api.slug}/report-card">reliability report card</a>, or
  <a href="/incidents">all recent incidents</a>.
</p>

<style>
  .crumbs {
    display: flex;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 1rem;
  }

  .crumbs a { color: var(--color-text-muted); }
  .crumbs a:hover { color: var(--color-primary); }

  h1 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
  }

  .sub {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    max-width: 640px;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
    font-size: 1.5rem;
    font-weight: 700;
    font-family: var(--font-mono);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
  }

  th, td {
    padding: 0.6rem 0.85rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  thead th {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody th { font-weight: 500; }

  .uptime { font-family: var(--font-mono); }
  .uptime-good { color: var(--color-operational); }
  .uptime-ok { color: var(--color-degraded); }
  .uptime-bad { color: var(--color-down); }
  .uptime-na { color: var(--color-text-muted); }

  .foot {
    margin-top: 1.5rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.7;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
