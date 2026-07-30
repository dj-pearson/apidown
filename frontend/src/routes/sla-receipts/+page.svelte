<script>
  import SEO from '$lib/components/SEO.svelte';
  import { formatDuration } from '$lib/api-history.js';
  import { categoryLabel } from '$lib/categories.js';

  let { data } = $props();

  let missed = $derived(data.scored.filter(r => r.met === false));
  let met = $derived(data.scored.filter(r => r.met === true));
</script>

<SEO
  title="SLA receipts — which API vendors met their published uptime SLA in {data.monthLabel} | APIdown.net"
  description="We compare each vendor's own published uptime commitment against the uptime we measured from real production traffic in {data.monthLabel}."
  canonical="https://apidown.net/sla-receipts"
/>

<h1>SLA receipts — {data.monthLabel}</h1>
<p class="sub">
  Vendors publish an uptime commitment. We measure uptime independently from real
  client-side traffic. This page puts the two numbers side by side for the last
  complete calendar month.
</p>

<div class="tally">
  <div class="tally-item tally-miss">
    <span class="tally-value">{missed.length}</span>
    <span class="tally-label">Came in under their published SLA</span>
  </div>
  <div class="tally-item tally-met">
    <span class="tally-value">{met.length}</span>
    <span class="tally-label">Met or beat it</span>
  </div>
  <div class="tally-item">
    <span class="tally-value">{data.noTarget.length}</span>
    <span class="tally-label">No published SLA on file</span>
  </div>
</div>

{#if data.scored.length === 0}
  <p class="empty">
    We don't yet have a published SLA figure on file for any tracked API, so there's nothing
    to compare for {data.monthLabel}. Published targets are recorded per vendor with a link to
    the document that states them.
  </p>
{:else}
  <div class="table-wrap">
    <table>
      <caption class="sr-only">Published SLA target versus measured uptime for {data.monthLabel}</caption>
      <thead>
        <tr>
          <th scope="col">API</th>
          <th scope="col">Published target</th>
          <th scope="col">We measured</th>
          <th scope="col">Difference</th>
          <th scope="col">Downtime</th>
          <th scope="col">Verdict</th>
        </tr>
      </thead>
      <tbody>
        {#each data.scored as row (row.slug)}
          <tr>
            <th scope="row">
              <a href="/api/{row.slug}/history/{data.month}">{row.name}</a>
              <span class="cat">{categoryLabel(row.category)}</span>
            </th>
            <td class="num">
              {#if row.targetUrl}
                <a href={row.targetUrl} target="_blank" rel="noopener nofollow" title={row.targetNote || 'Vendor SLA document'}>
                  {row.target}%
                </a>
              {:else}
                {row.target}%
              {/if}
            </td>
            <td class="num">{row.measured}%</td>
            <td class="num" class:neg={row.shortfall > 0}>
              {row.shortfall > 0 ? `−${row.shortfall}` : `+${Math.abs(row.shortfall)}`} pp
            </td>
            <td class="num">{formatDuration(row.downtimeMs)}</td>
            <td>
              <span class="verdict" class:miss={!row.met}>{row.met ? 'Met' : 'Missed'}</span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if data.unscored.length > 0}
  <section class="aside">
    <h2>Published a target, but we had no measurable traffic</h2>
    <p>These vendors publish a commitment, but we saw too little traffic in {data.monthLabel} to score them.</p>
    <ul class="chips">
      {#each data.unscored as row (row.slug)}
        <li><a href="/api/{row.slug}">{row.name}</a></li>
      {/each}
    </ul>
  </section>
{/if}

{#if data.noTarget.length > 0}
  <section class="aside">
    <h2>No published SLA on file</h2>
    <p>
      These APIs are tracked, but we don't have a public uptime commitment recorded for them —
      often because the vendor only offers one under an enterprise agreement. Their absence here
      is not a failing grade.
    </p>
    <ul class="chips">
      {#each data.noTarget as row (row.slug)}
        <li><a href="/api/{row.slug}">{row.name}</a></li>
      {/each}
    </ul>
  </section>
{/if}

<section class="methodology">
  <h2>Methodology, plainly</h2>
  <ul>
    <li>
      <strong>Our number is not the vendor's number.</strong> We measure from anonymised
      client-side signals sent by applications using the APIdown SDK. A vendor's own SLA
      accounting uses their internal instrumentation and their own definition of an outage.
      The two will not match, and where they differ theirs is the one that governs your credits.
    </li>
    <li>
      <strong>Downtime is attributed from detected incidents</strong>, clipped to the calendar
      month. Overlapping incidents are merged, so concurrent problems are not double-counted.
    </li>
    <li>
      <strong>Client-side measurement includes the network path.</strong> Failures caused by
      routing, DNS, or a CDN edge count against the API here, even where a vendor would
      exclude them.
    </li>
    <li>
      <strong>Published targets are only recorded with a source.</strong> Each percentage links
      to the vendor document stating it. Where we have no sourced figure, we say so rather than
      estimate one.
    </li>
    <li>
      <strong>Scope varies by vendor.</strong> A commitment may cover one service, one tier, or
      one region. Hover a target to see the caveat we recorded.
    </li>
  </ul>
  <p class="disclaimer">
    Nothing here is a legal determination of whether an SLA was breached or credits are owed.
    Use it as an independent second opinion, then check the vendor's own status history.
  </p>
</section>

<p class="foot">
  See also the <a href="/leaderboard">reliability leaderboard</a> and per-API
  <a href="/incidents">incident history</a>.
</p>

<style>
  h1 {
    font-size: 1.7rem;
    margin-bottom: 0.5rem;
  }

  .sub {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    max-width: 660px;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  .tally {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.75rem;
  }

  .tally-item {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.9rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .tally-miss { border-color: color-mix(in srgb, var(--color-down) 50%, transparent); }
  .tally-miss .tally-value { color: var(--color-down); }
  .tally-met { border-color: color-mix(in srgb, var(--color-operational) 40%, transparent); }
  .tally-met .tally-value { color: var(--color-operational); }

  .tally-value {
    font-size: 1.6rem;
    font-weight: 700;
    font-family: var(--font-mono);
    line-height: 1;
  }

  .tally-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: 10px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    background: var(--color-surface);
    min-width: 680px;
  }

  th, td {
    padding: 0.6rem 0.85rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  thead th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  tbody tr:last-child th,
  tbody tr:last-child td { border-bottom: none; }

  tbody th { font-weight: 500; }

  .cat {
    display: block;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .num {
    text-align: right;
    font-family: var(--font-mono);
  }

  .num.neg { color: var(--color-down); }

  .verdict {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-operational);
  }

  .verdict.miss {
    background: rgba(239, 68, 68, 0.15);
    color: var(--color-down);
  }

  .aside {
    margin-top: 2rem;
  }

  .aside h2 {
    font-size: 1rem;
    margin-bottom: 0.4rem;
  }

  .aside p {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    line-height: 1.6;
    max-width: 640px;
    margin-bottom: 0.75rem;
  }

  .chips {
    list-style: none;
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    padding: 0;
  }

  .chips a {
    display: inline-block;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.22rem 0.65rem;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .chips a:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .methodology {
    margin-top: 2.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1.5rem;
  }

  .methodology h2 {
    font-size: 1rem;
    margin-bottom: 0.85rem;
  }

  .methodology ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .methodology li {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.65;
    max-width: 720px;
  }

  .methodology strong { color: var(--color-text); }

  .disclaimer {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.8rem;
    color: var(--color-text-muted);
    line-height: 1.6;
  }

  .empty, .foot {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    line-height: 1.7;
    margin-top: 1.25rem;
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
