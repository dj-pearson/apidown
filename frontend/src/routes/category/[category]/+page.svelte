<script>
  import SEO from '$lib/components/SEO.svelte';

  let { data } = $props();

  let sortKey = $state('p95_ms');
  let sortDir = $state('asc');

  const columns = [
    { key: 'name', label: 'API', numeric: false },
    { key: 'status', label: 'Status', numeric: false },
    { key: 'p50_ms', label: 'p50 (1h)', numeric: true },
    { key: 'p95_ms', label: 'p95 (1h)', numeric: true },
    { key: 'errorRate', label: 'Error rate', numeric: true },
    { key: 'uptimePct', label: 'Uptime (30d)', numeric: true },
    { key: 'incidentCount', label: 'Incidents (90d)', numeric: true },
    { key: 'grade', label: 'Grade', numeric: false },
  ];

  function toggleSort(key) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      // Latency and incident counts read best ascending; scores descending.
      sortDir = ['p50_ms', 'p95_ms', 'errorRate', 'incidentCount', 'name'].includes(key) ? 'asc' : 'desc';
    }
  }

  let rows = $derived.by(() => {
    const sorted = [...data.apis].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Rows with no measurement always sink to the bottom.
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  });

  let fastest = $derived(data.apis.find(a => a.p95_ms !== null) || null);
  let measured = $derived(data.apis.filter(a => a.signals > 0).length);
</script>

<SEO
  title="{data.label} API latency and uptime, ranked live | APIdown.net"
  description="Live side-by-side p50/p95 latency, error rate, and 30-day uptime for every {data.label} API we track. Measured from real production traffic."
  canonical="https://apidown.net/category/{data.category}"
  alternates={[
    { type: 'application/rss+xml', href: `https://apidown.net/category/${data.category}/rss`, title: `${data.label} incident feed` },
  ]}
  schema={{
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${data.label} APIs ranked by measured latency`,
    url: `https://apidown.net/category/${data.category}`,
    numberOfItems: data.apis.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: data.apis.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: a.name,
      url: `https://apidown.net/api/${a.slug}`,
    })),
  }}
/>

<nav class="crumbs" aria-label="Breadcrumb">
  <a href="/">Status</a>
  <span aria-hidden="true">/</span>
  <span>{data.label}</span>
</nav>

<h1>{data.label} — ranked by measured latency</h1>
<p class="sub">
  {data.blurb} Every figure below comes from real client-side traffic through the APIdown SDK,
  not from vendor status pages. Sorted fastest p95 first.
</p>

{#if fastest}
  <div class="headline">
    <strong>{fastest.name}</strong> is currently the fastest {data.label} API we can measure, at
    <strong>{fastest.p95_ms}ms</strong> p95 over the last hour.
    <span class="asof">
      {measured} of {data.apis.length} APIs reporting ·
      as of <time datetime={data.generatedAt}>{new Date(data.generatedAt).toUTCString()}</time>
    </span>
  </div>
{/if}

{#if data.apis.length === 0}
  <p class="empty">No APIs are tracked in this category yet.</p>
{:else}
  <div class="table-wrap">
    <table>
      <caption class="sr-only">{data.label} APIs ranked by latency, uptime, and reliability grade</caption>
      <thead>
        <tr>
          {#each columns as col (col.key)}
            <th
              scope="col"
              class:numeric={col.numeric}
              aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button onclick={() => toggleSort(col.key)}>
                {col.label}
                {#if sortKey === col.key}<span aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>{/if}
              </button>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as api (api.slug)}
          <tr>
            <th scope="row"><a href="/api/{api.slug}">{api.name}</a></th>
            <td><span class="dot dot-{api.status}"></span>{api.status}</td>
            <td class="numeric">{api.p50_ms === null ? '—' : `${api.p50_ms}ms`}</td>
            <td class="numeric">{api.p95_ms === null ? '—' : `${api.p95_ms}ms`}</td>
            <td class="numeric">{api.errorRate === null ? '—' : `${api.errorRate}%`}</td>
            <td class="numeric">{api.uptimePct === null ? '—' : `${api.uptimePct}%`}</td>
            <td class="numeric">{api.incidentCount}</td>
            <td>
              <a
                href="/api/{api.slug}/report-card"
                class="grade"
                style="background: {api.gradeColor}20; color: {api.gradeColor}; border-color: {api.gradeColor}40"
              >{api.grade}</a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <p class="foot">
    Dashes mean we had no signals for that API in the window — not that it was down.
    See the <a href="/leaderboard">full reliability leaderboard</a>, subscribe to the
    <a href="/category/{data.category}/rss">{data.label} feed</a>, or
    <a href="/stack">build a stack watchlist</a>.
  </p>
{/if}

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

  .headline {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1rem 1.15rem;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .asof {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.75rem;
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
    min-width: 720px;
  }

  th, td {
    padding: 0.6rem 0.85rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  thead th { padding: 0; }

  thead th button {
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-family: inherit;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.65rem 0.85rem;
    text-align: left;
    cursor: pointer;
  }

  thead th.numeric button { text-align: right; }

  thead th button:hover { color: var(--color-text); }

  .numeric {
    text-align: right;
    font-family: var(--font-mono);
  }

  tbody tr:last-child th,
  tbody tr:last-child td { border-bottom: none; }

  tbody th { font-weight: 500; }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 0.4rem;
    background: var(--color-operational);
  }

  .dot-degraded { background: var(--color-degraded); }
  .dot-down { background: var(--color-down); }

  .grade {
    display: inline-block;
    border: 1px solid;
    border-radius: 5px;
    padding: 0.1rem 0.4rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-decoration: none;
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
