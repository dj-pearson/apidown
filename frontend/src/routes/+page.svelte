<script>
  import { createClient } from '@supabase/supabase-js';
  import StatusCard from '$lib/components/StatusCard.svelte';
  import SkeletonCard from '$lib/components/SkeletonCard.svelte';

  let { data } = $props();
  let apis = $state(data.apis);
  let activeIncidents = $state(data.activeIncidents);
  let sparklineData = data.sparklineData || {};
  let searchQuery = $state('');
  let sortMode = $state(typeof localStorage !== 'undefined' ? localStorage.getItem('apidown-sort') || 'category' : 'category');

  // Persist sort preference
  $effect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('apidown-sort', sortMode);
    }
  });

  const statusOrder = { down: 0, degraded: 1, operational: 2 };

  // Group APIs by category
  let groupedApis = $derived.by(() => {
    const filtered = searchQuery
      ? apis.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : apis;

    if (sortMode === 'status') {
      const sorted = [...filtered].sort((a, b) =>
        (statusOrder[a.current_status] ?? 2) - (statusOrder[b.current_status] ?? 2)
      );
      return { __flat: sorted };
    }

    if (sortMode === 'name') {
      const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      return { __flat: sorted };
    }

    const groups = {};
    for (const api of filtered) {
      const cat = api.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(api);
    }
    return groups;
  });

  const categoryLabels = {
    payments: 'Payments',
    ai: 'AI / LLM',
    communications: 'Communications',
    'cloud-aws': 'Cloud — AWS',
    'cloud-gcp': 'Cloud — GCP',
    'cloud-azure': 'Cloud — Azure',
    auth: 'Auth & Identity',
    database: 'Database / Storage',
    devtools: 'Dev Tools & Hosting',
    commerce: 'Commerce & Shipping',
  };

  let operationalCount = $derived(apis.filter(a => a.current_status === 'operational').length);
  let connectionStatus = $state('connecting'); // 'live' | 'connecting' | 'offline'

  // Real-time subscription via $effect — runs after layout's $effect has set up Supabase config
  $effect(() => {
    const url = data.supabaseUrl;
    const key = data.supabaseAnonKey;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const channel = supabase
      .channel('api-status-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'apis',
      }, (payload) => {
        apis = apis.map(a =>
          a.id === payload.new.id ? { ...a, ...payload.new } : a
        );
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') connectionStatus = 'live';
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') connectionStatus = 'offline';
        else connectionStatus = 'connecting';
      });

    return () => {
      supabase.removeChannel(channel);
    };
  });
</script>

<svelte:head>
  <title>APIdown.net — Real API Status from Real Traffic</title>
  <meta name="description" content="Real-time API health status powered by crowd-sourced production traffic. Is the API actually down — or is it your code?" />
  {@html `<script type="application/ld+json">${JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "APIdown.net",
      "url": "https://apidown.net",
      "description": "Real-time API health status powered by crowd-sourced production traffic. Monitor Stripe, OpenAI, AWS, Twilio, and 40+ APIs from real user data.",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Web",
      "browserRequirements": "Requires JavaScript",
      "offers": {
        "@type": "AggregateOffer",
        "lowPrice": "0",
        "highPrice": "49",
        "priceCurrency": "USD",
        "offerCount": "3"
      },
      "creator": {
        "@type": "Organization",
        "name": "Pearson Media LLC",
        "url": "https://apidown.net"
      },
      "featureList": "Real-time API monitoring, Crowd-sourced health signals, Incident tracking, Latency analytics, Email and webhook alerts, SDK integration"
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "APIdown.net",
      "url": "https://apidown.net",
      "description": "Is the API actually down — or is it your code? Real-time, crowd-sourced API health monitoring.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://apidown.net/api/{search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is APIdown and how does it work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "APIdown is a crowd-sourced, real-time API health monitoring platform. Instead of synthetic pings, it aggregates anonymized signals from real production traffic across thousands of applications to determine whether an API like Stripe, OpenAI, or AWS is actually experiencing issues."
          }
        },
        {
          "@type": "Question",
          "name": "Is APIdown free to use?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. The public status dashboard is completely free. You can view real-time status, latency trends, and incident history for all monitored APIs without an account. Paid plans unlock features like webhook alerts, custom API monitoring, and API access."
          }
        },
        {
          "@type": "Question",
          "name": "How is APIdown different from a traditional status page?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Traditional status pages are operated by the API provider and often lag behind real outages. APIdown uses independent, crowd-sourced data from actual production traffic, giving you a neutral, real-time view of API health before the provider acknowledges a problem."
          }
        },
        {
          "@type": "Question",
          "name": "Which APIs does APIdown monitor?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "APIdown monitors over 40 popular APIs across categories including Payments (Stripe, PayPal), AI/LLM (OpenAI, Anthropic), Cloud (AWS, GCP, Azure), Communications (Twilio, SendGrid), Auth (Auth0, Clerk), and more. New APIs are added regularly based on community demand."
          }
        },
        {
          "@type": "Question",
          "name": "How do I get alerts when an API goes down?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Create a free account and subscribe to any APIs you depend on. You'll receive email alerts when status changes are detected. Paid plans add webhook notifications so you can trigger automated incident responses in your own infrastructure."
          }
        },
        {
          "@type": "Question",
          "name": "Can I monitor my own custom APIs with APIdown?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Pro and Enterprise plans let you add custom API endpoints to the monitoring network. Your custom APIs benefit from the same crowd-sourced signal aggregation and alerting as the built-in catalog."
          }
        }
      ]
    }
  ])}</script>`}
</svelte:head>

<div class="hero">
  <div class="connection-indicator">
    {#if connectionStatus === 'live'}
      <span class="conn-dot conn-live"></span> <span class="conn-text">Live</span>
    {:else if connectionStatus === 'connecting'}
      <span class="conn-dot conn-connecting"></span> <span class="conn-text">Reconnecting…</span>
    {:else}
      <span class="conn-dot conn-offline"></span> <span class="conn-text">Offline</span>
    {/if}
  </div>
  <h1>Real-Time API Status Dashboard — Powered by Production Traffic</h1>
  <p class="subtitle">Is the API actually down — or is it your code? Find out in seconds with crowd-sourced health data from real applications.</p>
  <div class="stats">
    <span class="stat">{apis.length} APIs monitored</span>
    <span class="divider">·</span>
    <span class="stat">{activeIncidents.length} active incident{activeIncidents.length !== 1 ? 's' : ''}</span>
    <span class="divider">·</span>
    <span class="stat stat-ok">{operationalCount}/{apis.length} operational</span>
  </div>
</div>

<div class="toolbar">
  <div class="search-bar">
    <input
      type="text"
      placeholder="Search APIs..."
      bind:value={searchQuery}
      aria-label="Search APIs by name"
    />
  </div>
  <div class="sort-options" role="group" aria-label="Sort APIs">
    <button class:active={sortMode === 'category'} onclick={() => sortMode = 'category'}>By Category</button>
    <button class:active={sortMode === 'status'} onclick={() => sortMode = 'status'}>By Status</button>
    <button class:active={sortMode === 'name'} onclick={() => sortMode = 'name'}>By Name</button>
  </div>
</div>

{#if apis.length === 0}
  <div class="loading-grid">
    {#each { length: 8 } as _}
      <SkeletonCard />
    {/each}
  </div>
{:else if searchQuery && Object.keys(groupedApis).length === 0}
  <div class="empty-search">
    <p>No APIs match "<strong>{searchQuery}</strong>"</p>
    <button class="clear-search" onclick={() => searchQuery = ''}>Clear search</button>
  </div>
{:else}
  {#if groupedApis.__flat}
    <div class="grid">
      {#each groupedApis.__flat as api (api.id)}
        <StatusCard {api} sparkline={sparklineData[api.id] || []} />
      {/each}
    </div>
  {:else}
    {#each Object.entries(groupedApis) as [category, categoryApis]}
      <section class="category">
        <h2>{categoryLabels[category] || category}</h2>
        <div class="grid">
          {#each categoryApis as api (api.id)}
            <StatusCard {api} sparkline={sparklineData[api.id] || []} />
          {/each}
        </div>
      </section>
    {/each}
  {/if}
{/if}

<!-- How It Works -->
<section class="seo-section" aria-labelledby="how-it-works">
  <h2 id="how-it-works">How APIdown Works</h2>
  <p class="section-intro">Unlike traditional status pages controlled by the provider, APIdown aggregates anonymized signals from <strong>real production traffic</strong> to give you an independent, crowd-sourced view of API health.</p>
  <div class="features-grid">
    <div class="feature-card">
      <div class="feature-icon">📡</div>
      <h3>Crowd-Sourced Signals</h3>
      <p>Lightweight SDKs report latency and error rates from thousands of production apps — no synthetic pings required.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">⚡</div>
      <h3>Real-Time Detection</h3>
      <p>Outages and degradations surface within seconds thanks to continuous signal aggregation and anomaly detection.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🔔</div>
      <h3>Instant Alerts</h3>
      <p>Get email or webhook notifications the moment an API you depend on shows signs of trouble — before the provider discloses it.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">📊</div>
      <h3>Latency Analytics</h3>
      <p>View per-region latency trends, percentile breakdowns, and 24-hour sparkline charts for every monitored API.</p>
    </div>
  </div>
</section>

<!-- Why APIdown -->
<section class="seo-section" aria-labelledby="why-apidown">
  <h2 id="why-apidown">Why Developers Trust APIdown</h2>
  <div class="trust-grid">
    <div class="trust-item">
      <strong>Independent & Neutral</strong>
      <p>APIdown is not operated by any API provider. The data comes from your peers — real developers running real workloads.</p>
    </div>
    <div class="trust-item">
      <strong>Faster Than Official Status Pages</strong>
      <p>Community signals often detect problems minutes before the vendor acknowledges them. Stop refreshing their status page.</p>
    </div>
    <div class="trust-item">
      <strong>40+ APIs, Growing Weekly</strong>
      <p>From Stripe and OpenAI to AWS S3 and Twilio — monitor the APIs your stack depends on, all in one dashboard.</p>
    </div>
    <div class="trust-item">
      <strong>Free Forever Tier</strong>
      <p>The public dashboard is free with no account required. Paid plans add alerts, webhooks, custom APIs, and API access.</p>
    </div>
  </div>
</section>

<!-- FAQ Section -->
<section class="seo-section faq-section" aria-labelledby="faq-heading">
  <h2 id="faq-heading">Frequently Asked Questions</h2>
  <div class="faq-list">
    <details class="faq-item">
      <summary>What is APIdown and how does it work?</summary>
      <div class="faq-answer">
        <p>APIdown is a crowd-sourced, real-time API health monitoring platform. Instead of synthetic pings, it aggregates anonymized signals from real production traffic across thousands of applications to determine whether an API like Stripe, OpenAI, or AWS is actually experiencing issues. The lightweight SDK reports latency and error-rate data, and our backend uses anomaly detection to flag degradations or outages within seconds.</p>
      </div>
    </details>
    <details class="faq-item">
      <summary>Is APIdown free to use?</summary>
      <div class="faq-answer">
        <p>Yes. The public status dashboard is completely free. You can view real-time status, latency trends, and incident history for all monitored APIs without an account. Paid plans unlock features like webhook alerts, custom API monitoring, and programmatic API access.</p>
      </div>
    </details>
    <details class="faq-item">
      <summary>How is APIdown different from a traditional status page?</summary>
      <div class="faq-answer">
        <p>Traditional status pages are operated by the API provider and often lag behind real outages. APIdown uses independent, crowd-sourced data from actual production traffic, giving you a neutral, real-time view of API health before the provider acknowledges a problem. Think of it as "Waze for API status."</p>
      </div>
    </details>
    <details class="faq-item">
      <summary>Which APIs does APIdown monitor?</summary>
      <div class="faq-answer">
        <p>APIdown monitors over 40 popular APIs across categories including Payments (Stripe, PayPal), AI/LLM (OpenAI, Anthropic), Cloud (AWS, GCP, Azure), Communications (Twilio, SendGrid), Auth (Auth0, Clerk), and more. New APIs are added regularly based on community demand.</p>
      </div>
    </details>
    <details class="faq-item">
      <summary>How do I get alerts when an API goes down?</summary>
      <div class="faq-answer">
        <p>Create a free account and subscribe to any APIs you depend on. You'll receive email alerts when status changes are detected. Paid plans add webhook notifications so you can trigger automated incident responses in your own infrastructure.</p>
      </div>
    </details>
    <details class="faq-item">
      <summary>Can I monitor my own custom APIs with APIdown?</summary>
      <div class="faq-answer">
        <p>Yes. Pro and Enterprise plans let you add custom API endpoints to the monitoring network. Your custom APIs benefit from the same crowd-sourced signal aggregation and alerting as the built-in catalog.</p>
      </div>
    </details>
  </div>
</section>

<style>
  .hero {
    text-align: center;
    margin-bottom: 2rem;
    position: relative;
  }

  .connection-indicator {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .conn-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .conn-live {
    background: var(--color-operational);
    box-shadow: 0 0 6px var(--color-operational);
  }

  .conn-connecting {
    background: var(--color-degraded);
    animation: pulse-dot 1s ease-in-out infinite;
  }

  .conn-offline {
    background: var(--color-down);
  }

  .conn-text {
    color: var(--color-text-muted);
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
  }

  .subtitle {
    color: var(--color-text-muted);
    margin-top: 0.25rem;
  }

  .stats {
    margin-top: 1rem;
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .stat-ok {
    color: var(--color-operational);
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .search-bar input {
    width: 300px;
    padding: 0.6rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-bar input:focus {
    border-color: var(--color-primary);
  }

  .sort-options {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .sort-options button {
    background: var(--color-surface);
    border: none;
    border-right: 1px solid var(--color-border);
    color: var(--color-text-muted);
    padding: 0.5rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .sort-options button:last-child {
    border-right: none;
  }

  .sort-options button:hover {
    color: var(--color-text);
  }

  .sort-options button.active {
    background: var(--color-primary);
    color: #fff;
  }

  .category {
    margin-bottom: 2rem;
  }

  .category h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
  }

  .grid, .loading-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 0.75rem;
  }

  .empty-search {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border-radius: 12px;
    border: 1px solid var(--color-border);
  }

  .empty-search p {
    margin-bottom: 1rem;
  }

  .clear-search {
    background: none;
    border: 1px solid var(--color-border);
    color: var(--color-primary);
    padding: 0.4rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .clear-search:hover {
    border-color: var(--color-primary);
  }

  /* SEO sections */
  .seo-section {
    margin-top: 3rem;
    padding-top: 2.5rem;
    border-top: 1px solid var(--color-border);
  }

  .seo-section h2 {
    font-size: 1.35rem;
    font-weight: 700;
    text-align: center;
    margin-bottom: 0.5rem;
  }

  .section-intro {
    text-align: center;
    color: var(--color-text-muted);
    max-width: 680px;
    margin: 0 auto 2rem;
    line-height: 1.6;
  }

  /* Features grid */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1.25rem;
  }

  .feature-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 1.5rem;
    transition: border-color 0.2s;
  }

  .feature-card:hover {
    border-color: var(--color-primary);
  }

  .feature-icon {
    font-size: 1.75rem;
    margin-bottom: 0.75rem;
  }

  .feature-card h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
  }

  .feature-card p {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    line-height: 1.55;
  }

  /* Trust grid */
  .trust-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.25rem;
    margin-top: 1.5rem;
  }

  .trust-item {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
  }

  .trust-item strong {
    display: block;
    font-size: 0.95rem;
    margin-bottom: 0.35rem;
    color: var(--color-text);
  }

  .trust-item p {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.55;
  }

  /* FAQ section */
  .faq-section {
    margin-bottom: 2rem;
  }

  .faq-list {
    max-width: 760px;
    margin: 1.5rem auto 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .faq-item {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.2s;
  }

  .faq-item[open] {
    border-color: var(--color-primary);
  }

  .faq-item summary {
    padding: 1rem 1.25rem;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--color-text);
    transition: color 0.15s;
  }

  .faq-item summary::-webkit-details-marker {
    display: none;
  }

  .faq-item summary::after {
    content: '+';
    font-size: 1.2rem;
    font-weight: 400;
    color: var(--color-text-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
    margin-left: 1rem;
  }

  .faq-item[open] summary::after {
    content: '−';
    color: var(--color-primary);
  }

  .faq-item summary:hover {
    color: var(--color-primary-light);
  }

  .faq-answer {
    padding: 0 1.25rem 1.15rem;
  }

  .faq-answer p {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    line-height: 1.65;
  }
</style>
