<script>
  import { page } from '$app/state';
  import SEO from '$lib/components/SEO.svelte';

  const comparisonRows = [
    {
      label: 'Detection time',
      apidown: '< 30 seconds',
      vendor: '15–60 minutes',
      icon: '⚡'
    },
    {
      label: 'Independence',
      apidown: 'Fully independent',
      vendor: 'Self-reported',
      icon: '🛡️'
    },
    {
      label: 'Data source',
      apidown: 'Real production traffic',
      vendor: 'Synthetic pings',
      icon: '📡'
    },
    {
      label: 'Coverage',
      apidown: '40+ APIs, one dashboard',
      vendor: 'One per vendor',
      icon: '📊'
    },
    {
      label: 'Cost',
      apidown: 'Free forever tier',
      vendor: 'Varies per vendor',
      icon: '💰'
    },
    {
      label: 'Real-time accuracy',
      apidown: 'Crowd-sourced from thousands',
      vendor: 'Internal monitoring only',
      icon: '🎯'
    }
  ];

  const examples = [
    {
      id: 1,
      text: 'In January 2024, a major payment processor was down for 45 minutes before their status page reflected the issue. APIdown users were notified within 28 seconds.',
      highlight: '28 seconds vs 45 minutes'
    },
    {
      id: 2,
      text: 'A popular AI API experienced severe latency degradation. Their status page showed \'All Systems Operational\' for over an hour while developers reported 10x normal response times.',
      highlight: 'Over 1 hour delay'
    },
    {
      id: 3,
      text: 'During a cloud provider regional outage, the vendor\'s status page loaded from an unaffected region \u2014 showing green while services were unreachable.',
      highlight: 'False green status'
    }
  ];
</script>

<SEO
  title="APIdown vs Traditional Vendor Status Pages | APIdown"
  description="Compare APIdown's crowd-sourced API monitoring with traditional vendor status pages. Faster detection, independent verification, and real production traffic analysis."
  canonical="https://apidown.net/compare"
  schema={{
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "APIdown vs Traditional Vendor Status Pages",
    "description": "Compare APIdown's crowd-sourced API monitoring with traditional vendor status pages.",
    "url": "https://apidown.net/compare",
    "mainEntity": {
      "@type": "Table",
      "about": "Comparison of APIdown and traditional vendor status pages"
    },
    "publisher": {
      "@type": "Organization",
      "name": "APIdown",
      "url": "https://apidown.net"
    }
  }}
/>

<div class="compare-page">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li aria-current="page">Why APIdown</li>
    </ol>
  </nav>

  <header class="hero">
    <h1>APIdown vs Traditional Vendor Status Pages</h1>
    <p class="subtitle">
      Vendor status pages are self-reported and often delayed. APIdown uses
      <strong>crowd-sourced monitoring from real production traffic</strong> to detect
      outages in seconds — not minutes or hours. See the difference.
    </p>
  </header>

  <section class="comparison-section" aria-labelledby="comparison-heading">
    <h2 id="comparison-heading" class="sr-only">Feature Comparison</h2>
    <div class="table-wrapper">
      <table class="comparison-table">
        <thead>
          <tr>
            <th class="feature-col">Feature</th>
            <th class="apidown-col">
              <span class="col-badge apidown-badge">APIdown</span>
            </th>
            <th class="vendor-col">
              <span class="col-badge vendor-badge">Vendor Status Pages</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {#each comparisonRows as row}
            <tr>
              <td class="feature-cell">
                <span class="feature-icon">{row.icon}</span>
                <span>{row.label}</span>
              </td>
              <td class="apidown-cell">
                <span class="check-icon" aria-hidden="true">&#10003;</span>
                {row.apidown}
              </td>
              <td class="vendor-cell">
                <span class="cross-icon" aria-hidden="true">&#10007;</span>
                {row.vendor}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="examples-section" aria-labelledby="examples-heading">
    <h2 id="examples-heading">Real-World Examples</h2>
    <p class="examples-subtitle">
      These scenarios happen more often than vendors would like to admit.
    </p>
    <div class="examples-grid">
      {#each examples as example}
        <article class="example-card">
          <div class="example-number">#{example.id}</div>
          <p class="example-text">{example.text}</p>
          <div class="example-highlight">{example.highlight}</div>
        </article>
      {/each}
    </div>
  </section>

  <section class="cta-section" aria-labelledby="cta-heading">
    <h2 id="cta-heading">Stop Relying on Vendor Self-Reports</h2>
    <p>Join thousands of developers who trust crowd-sourced monitoring for real-time, independent API status.</p>
    <a href="/login" class="cta-button">Start Monitoring for Free</a>
  </section>
</div>

<style>
  .compare-page {
    --color-bg: #0F172A;
    --color-surface: #1E293B;
    --color-border: #334155;
    --color-text: #F8FAFC;
    --color-text-muted: #94A3B8;
    --color-primary: #06B6D4;

    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
    color: var(--color-text);
  }

  /* Breadcrumb */
  .breadcrumb ol {
    display: flex;
    gap: 0.5rem;
    list-style: none;
    padding: 0;
    margin: 0 0 2rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .breadcrumb li:not(:last-child)::after {
    content: '>';
    margin-left: 0.5rem;
    color: var(--color-border);
  }

  .breadcrumb a {
    color: var(--color-primary);
    text-decoration: none;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  /* Hero */
  .hero {
    text-align: center;
    margin-bottom: 3rem;
  }

  .hero h1 {
    font-size: 2.25rem;
    font-weight: 800;
    line-height: 1.2;
    margin: 0 0 1rem;
    color: var(--color-text);
  }

  .subtitle {
    font-size: 1.125rem;
    line-height: 1.6;
    color: var(--color-text-muted);
    max-width: 680px;
    margin: 0 auto;
  }

  .subtitle strong {
    color: var(--color-primary);
    font-weight: 600;
  }

  /* SR-only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Comparison Table */
  .comparison-section {
    margin-bottom: 3.5rem;
  }

  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: 12px;
    border: 1px solid var(--color-border);
  }

  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 580px;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 1rem 1.25rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .comparison-table thead th {
    background: var(--color-surface);
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .comparison-table tbody tr:last-child td {
    border-bottom: none;
  }

  .comparison-table tbody tr {
    background: rgba(30, 41, 59, 0.5);
    transition: background 0.15s ease;
  }

  .comparison-table tbody tr:hover {
    background: var(--color-surface);
  }

  .feature-col {
    width: 30%;
  }

  .apidown-col,
  .vendor-col {
    width: 35%;
  }

  .col-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .apidown-badge {
    background: rgba(6, 182, 212, 0.15);
    color: var(--color-primary);
  }

  .vendor-badge {
    background: rgba(148, 163, 184, 0.15);
    color: var(--color-text-muted);
  }

  .feature-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .feature-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .apidown-cell {
    color: var(--color-primary);
    font-weight: 500;
  }

  .vendor-cell {
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .check-icon {
    color: #22c55e;
    font-weight: 700;
    margin-right: 0.4rem;
  }

  .cross-icon {
    color: #ef4444;
    font-weight: 700;
    margin-right: 0.4rem;
  }

  /* Examples */
  .examples-section {
    margin-bottom: 3.5rem;
  }

  .examples-section h2 {
    font-size: 1.75rem;
    font-weight: 700;
    text-align: center;
    margin: 0 0 0.5rem;
    color: var(--color-text);
  }

  .examples-subtitle {
    text-align: center;
    color: var(--color-text-muted);
    margin: 0 0 2rem;
    font-size: 1rem;
  }

  .examples-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .example-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }

  .example-card:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
  }

  .example-number {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .example-text {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--color-text-muted);
    margin: 0;
    flex: 1;
  }

  .example-highlight {
    display: inline-block;
    padding: 0.3rem 0.75rem;
    background: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.25);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-primary);
    align-self: flex-start;
  }

  /* CTA */
  .cta-section {
    text-align: center;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: 3rem 2rem;
  }

  .cta-section h2 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.75rem;
    color: var(--color-text);
  }

  .cta-section p {
    color: var(--color-text-muted);
    font-size: 1.0625rem;
    margin: 0 0 1.5rem;
    max-width: 520px;
    margin-left: auto;
    margin-right: auto;
  }

  .cta-button {
    display: inline-block;
    padding: 0.875rem 2.5rem;
    background: var(--color-primary);
    color: var(--color-bg);
    font-size: 1rem;
    font-weight: 700;
    text-decoration: none;
    border-radius: 8px;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .cta-button:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .cta-button:active {
    transform: translateY(0);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .compare-page {
      padding: 1.5rem 1rem 3rem;
    }

    .hero h1 {
      font-size: 1.625rem;
    }

    .subtitle {
      font-size: 1rem;
    }

    .examples-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .examples-section h2,
    .cta-section h2 {
      font-size: 1.375rem;
    }

    .cta-section {
      padding: 2rem 1.25rem;
    }
  }

  @media (max-width: 480px) {
    .hero h1 {
      font-size: 1.375rem;
    }

    .comparison-table th,
    .comparison-table td {
      padding: 0.75rem 0.75rem;
      font-size: 0.875rem;
    }
  }
</style>
