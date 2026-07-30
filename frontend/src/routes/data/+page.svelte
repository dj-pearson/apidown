<script>
  import SEO from '$lib/components/SEO.svelte';

  const datasets = [
    {
      name: 'Incident history',
      slug: 'incidents',
      description:
        'Every outage and degradation we have detected across all tracked APIs, with severity, start and resolution times, and duration.',
      rowLimit: '5,000 most recent incidents',
      columns: [
        ['incident_id', 'Stable identifier; also the URL suffix at /incidents/{id}'],
        ['api_slug, api_name, category', 'Which API the incident belongs to'],
        ['severity', 'critical, major, or minor'],
        ['status', 'investigating, identified, monitoring, or resolved'],
        ['title', 'Short human description'],
        ['started_at, resolved_at', 'ISO 8601 timestamps; resolved_at empty while open'],
        ['duration_minutes', 'Empty while the incident is still open'],
      ],
    },
    {
      name: 'Monthly uptime',
      slug: 'uptime',
      description:
        'One row per API per calendar month: measured uptime, incident count, total downtime, and longest single outage.',
      rowLimit: 'Last 24 months, all tracked APIs',
      columns: [
        ['api_slug, api_name, category', 'Which API the row describes'],
        ['month', 'Calendar month as YYYY-MM (UTC)'],
        ['uptime_pct', 'Measured uptime for that month, three decimals'],
        ['incident_count', 'Incidents overlapping the month'],
        ['downtime_minutes', 'Total downtime, overlapping incidents merged'],
        ['longest_outage_minutes', 'Longest single outage in the month'],
      ],
    },
  ];
</script>

<SEO
  title="Open data — download APIdown's incident and uptime datasets | APIdown.net"
  description="Free CSV and JSON downloads of API incident history and monthly uptime, measured from real production traffic. Attribution requested."
  canonical="https://apidown.net/data"
  schema={[
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'APIdown incident history',
      description: 'Detected outages and degradations across tracked third-party APIs.',
      url: 'https://apidown.net/data',
      isAccessibleForFree: true,
      creator: { '@type': 'Organization', name: 'APIdown.net', url: 'https://apidown.net' },
      distribution: [
        { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: 'https://apidown.net/data/incidents.csv' },
        { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: 'https://apidown.net/data/incidents.json' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'APIdown monthly uptime',
      description: 'Monthly measured uptime, downtime, and incident counts per tracked API.',
      url: 'https://apidown.net/data',
      isAccessibleForFree: true,
      creator: { '@type': 'Organization', name: 'APIdown.net', url: 'https://apidown.net' },
      distribution: [
        { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: 'https://apidown.net/data/uptime.csv' },
        { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: 'https://apidown.net/data/uptime.json' },
      ],
    },
  ]}
/>

<h1>Open data</h1>
<p class="sub">
  APIdown's incident and uptime history, free to download in CSV or JSON. Useful for research,
  vendor due diligence, blog posts, or plotting your own charts. No account, no key.
</p>

{#each datasets as ds (ds.slug)}
  <section class="dataset">
    <div class="ds-head">
      <div>
        <h2>{ds.name}</h2>
        <p class="ds-desc">{ds.description}</p>
        <p class="ds-scope">{ds.rowLimit}</p>
      </div>
      <div class="ds-downloads">
        <a href="/data/{ds.slug}.csv" class="btn">Download CSV</a>
        <a href="/data/{ds.slug}.json" class="btn btn-ghost">Download JSON</a>
      </div>
    </div>

    <table>
      <caption class="sr-only">{ds.name} dataset columns</caption>
      <thead>
        <tr><th scope="col">Column</th><th scope="col">Meaning</th></tr>
      </thead>
      <tbody>
        {#each ds.columns as [col, meaning] (col)}
          <tr>
            <th scope="row"><code>{col}</code></th>
            <td>{meaning}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/each}

<section class="notes">
  <h2>How to use it</h2>
  <ul>
    <li>
      <strong>Attribution.</strong> These datasets are free to use, including commercially.
      We ask that you credit “APIdown.net” and link to <code>https://apidown.net</code> wherever
      you publish figures derived from them.
    </li>
    <li>
      <strong>What the numbers are.</strong> Everything here is measured from anonymised
      client-side signals sent by applications running the APIdown SDK. They are our
      independent measurement, not the vendor's own reporting, and the two will differ.
      Client-side measurement includes the network path, so routing and DNS failures count
      against an API here.
    </li>
    <li>
      <strong>What is not included.</strong> No user, account, subscriber, or API-key data
      appears in these files, and no per-request or per-customer data — only public APIs and
      the incidents recorded against them.
    </li>
    <li>
      <strong>Freshness.</strong> Both datasets are generated on request and cached for an hour.
      For live values use the <a href="/docs#v1-api">/v1 API</a> instead.
    </li>
  </ul>
</section>

<p class="foot">
  Need this programmatically, filtered, or in bulk beyond the row limits? The
  <a href="/docs#v1-api">public /v1 API</a> covers the same data with query parameters.
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
    margin-bottom: 2rem;
  }

  .dataset {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1.35rem;
    margin-bottom: 1.5rem;
  }

  .ds-head {
    display: flex;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 1.15rem;
  }

  .dataset h2 {
    font-size: 1.1rem;
    margin-bottom: 0.35rem;
  }

  .ds-desc {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    line-height: 1.6;
    max-width: 520px;
  }

  .ds-scope {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-top: 0.4rem;
    font-family: var(--font-mono);
  }

  .ds-downloads {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .btn {
    background: var(--color-primary);
    color: #fff;
    border-radius: 6px;
    padding: 0.45rem 0.9rem;
    font-size: 0.82rem;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }

  .btn:hover { opacity: 0.9; text-decoration: none; }

  .btn-ghost {
    background: none;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
  }

  .btn-ghost:hover {
    border-color: var(--color-primary);
    color: var(--color-text);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  th, td {
    padding: 0.45rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }

  thead th {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  tbody tr:last-child th,
  tbody tr:last-child td { border-bottom: none; }

  tbody th { font-weight: 400; white-space: nowrap; }

  td { color: var(--color-text-muted); }

  code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color-primary);
  }

  .notes {
    margin-top: 2rem;
  }

  .notes h2 {
    font-size: 1.05rem;
    margin-bottom: 0.85rem;
  }

  .notes ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .notes li {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.65;
    max-width: 720px;
  }

  .notes strong { color: var(--color-text); }

  .foot {
    margin-top: 1.75rem;
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
