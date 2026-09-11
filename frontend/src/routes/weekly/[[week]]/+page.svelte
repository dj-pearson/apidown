<script>
  import SEO from '$lib/components/SEO.svelte';
  import { formatMinutes } from '$lib/weekly-digest.js';

  let { data } = $props();
  let d = $derived(data.digest);
</script>

<SEO
  title="API Weather Report — {d.weekLabel} | APIdown.net"
  description={d.headline}
  canonical="https://apidown.net/weekly/{data.canonicalWeek}"
  schema={{
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: `API Weather Report — ${d.weekLabel}`,
    description: d.headline,
    url: `https://apidown.net/weekly/${data.canonicalWeek}`,
    datePublished: d.windowEnd,
    author: { '@type': 'Organization', name: 'APIdown.net', url: 'https://apidown.net' },
  }}
/>

<nav class="crumbs" aria-label="Breadcrumb">
  <a href="/">Status</a>
  <span aria-hidden="true">/</span>
  <a href="/weekly">Weekly</a>
  <span aria-hidden="true">/</span>
  <span>{d.week}</span>
</nav>

<h1>API Weather Report</h1>
<p class="week">{d.weekLabel} · {d.week}</p>
<p class="headline">{d.headline}</p>

<div class="totals">
  <div class="stat">
    <span class="stat-value">{d.totals.incidents}</span>
    <span class="stat-label">Incidents</span>
  </div>
  <div class="stat">
    <span class="stat-value">{d.totals.apisAffected}</span>
    <span class="stat-label">APIs affected</span>
  </div>
  <div class="stat">
    <span class="stat-value">{formatMinutes(d.totals.downtimeMinutes)}</span>
    <span class="stat-label">Total downtime</span>
  </div>
  <div class="stat">
    <span class="stat-value">{d.cleanSheetCount}</span>
    <span class="stat-label">Clean sheet</span>
  </div>
</div>

{#if d.biggestOutages.length > 0}
  <section>
    <h2>Biggest outages</h2>
    <ol class="outages">
      {#each d.biggestOutages as o (o.incidentId)}
        <li>
          <span class="sev sev-{o.severity}">{o.severity}</span>
          <a href="/api/{o.apiSlug}" class="o-api">{o.apiName}</a>
          <a href="/incidents/{o.incidentId}" class="o-title">{o.title}</a>
          <span class="o-dur">{formatMinutes(o.durationMinutes)}</span>
        </li>
      {/each}
    </ol>
  </section>
{/if}

{#if d.regressions.length > 0}
  <section>
    <h2>Got slower</h2>
    <ul class="movers">
      {#each d.regressions as m (m.apiSlug)}
        <li>
          <a href="/api/{m.apiSlug}">{m.apiName}</a>
          <span class="mover-change worse">+{m.changePct}%</span>
          <span class="mover-detail">p95 {m.p95Before}ms → {m.p95Now}ms</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if d.improvements.length > 0}
  <section>
    <h2>Got faster</h2>
    <ul class="movers">
      {#each d.improvements as m (m.apiSlug)}
        <li>
          <a href="/api/{m.apiSlug}">{m.apiName}</a>
          <span class="mover-change better">{m.changePct}%</span>
          <span class="mover-detail">p95 {m.p95Before}ms → {m.p95Now}ms</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if d.categories.length > 0}
  <section>
    <h2>Where the trouble was</h2>
    <table>
      <caption class="sr-only">Incidents and downtime by category for {d.weekLabel}</caption>
      <thead>
        <tr><th scope="col">Category</th><th scope="col">Incidents</th><th scope="col">Downtime</th></tr>
      </thead>
      <tbody>
        {#each d.categories as c (c.category)}
          <tr>
            <th scope="row"><a href="/category/{c.category}">{c.label}</a></th>
            <td class="num">{c.count}</td>
            <td class="num">{formatMinutes(c.downtimeMinutes)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

{#if d.cleanSheet.length > 0}
  <section>
    <h2>Clean sheet</h2>
    <p class="section-note">
      {d.cleanSheetCount} of {d.totals.apisTracked} tracked APIs had no recorded incident this week.
    </p>
    <ul class="chips">
      {#each d.cleanSheet as a (a.slug)}
        <li><a href="/api/{a.slug}">{a.name}</a></li>
      {/each}
      {#if d.cleanSheetCount > d.cleanSheet.length}
        <li class="chip-more">+{d.cleanSheetCount - d.cleanSheet.length} more</li>
      {/if}
    </ul>
  </section>
{/if}

<nav class="week-nav" aria-label="Week navigation">
  <a href="/weekly/{data.prevWeek}">← {data.prevWeek}</a>
  {#if data.nextWeek}
    <a href="/weekly/{data.nextWeek}">{data.nextWeek} →</a>
  {:else}
    <span class="disabled">Next week →</span>
  {/if}
</nav>

<section class="archive">
  <h2>Archive</h2>
  <ul class="chips">
    {#each data.archive as w (w)}
      <li><a href="/weekly/{w}" class:current={w === data.canonicalWeek}>{w}</a></li>
    {/each}
  </ul>
</section>

<p class="foot">
  Want this in your inbox every week? Subscribe with the form in the footer. Figures are
  measured from crowd-sourced client-side traffic, not vendor reporting.
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
    margin-bottom: 0.25rem;
  }

  .week {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 1rem;
  }

  .headline {
    font-size: 1.05rem;
    line-height: 1.6;
    max-width: 660px;
    margin-bottom: 1.75rem;
  }

  .totals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
    margin-bottom: 2rem;
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
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  section { margin-bottom: 2rem; }

  section h2 {
    font-size: 1.05rem;
    margin-bottom: 0.75rem;
  }

  .section-note {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    margin-bottom: 0.75rem;
  }

  .outages {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    counter-reset: outage;
  }

  .outages li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.6rem 0.85rem;
    font-size: 0.875rem;
  }

  .o-api { font-weight: 600; }

  .o-title {
    flex: 1;
    color: var(--color-text-muted);
    min-width: 200px;
  }

  .o-title:hover { color: var(--color-primary); }

  .o-dur {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .movers {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .movers li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.875rem;
    flex-wrap: wrap;
  }

  .mover-change {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.82rem;
  }

  .worse { color: var(--color-down); }
  .better { color: var(--color-operational); }

  .mover-detail {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
  }

  th, td {
    padding: 0.55rem 0.85rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  thead th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  tbody tr:last-child th,
  tbody tr:last-child td { border-bottom: none; }

  tbody th { font-weight: 500; }

  .num { text-align: right; font-family: var(--font-mono); }

  .chips {
    list-style: none;
    padding: 0;
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .chips a, .chip-more {
    display: inline-block;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .chips a:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .chips a.current {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .week-nav {
    display: flex;
    gap: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.85rem;
    font-family: var(--font-mono);
    margin-bottom: 2rem;
  }

  .week-nav .disabled {
    color: var(--color-text-muted);
    opacity: 0.45;
  }

  .foot {
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
