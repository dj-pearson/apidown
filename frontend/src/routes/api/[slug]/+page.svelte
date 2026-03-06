<script>
  import { createClient } from "@supabase/supabase-js";
  import LatencyChart from "$lib/components/LatencyChart.svelte";
  import RegionBreakdown from "$lib/components/RegionBreakdown.svelte";
  import UptimeBar from "$lib/components/UptimeBar.svelte";
  import SEO from "$lib/components/SEO.svelte";

  let { data } = $props();
  let api = $state(data.api);
  let incidents = $state(data.incidents);
  let latencyData = $state(data.latencyData);
  let logoFailed = $state(false);

  // Report button state
  let reportSubmitting = $state(false);
  let reportMessage = $state("");

  // Subscribe form state
  let showSubscribe = $state(false);
  let subEmail = $state("");
  let subSubmitting = $state(false);
  let subMessage = $state("");

  const ingestUrl = data.ingestUrl;

  const statusColors = {
    operational: "var(--color-operational)",
    degraded: "var(--color-degraded)",
    down: "var(--color-down)",
  };

  const statusLabels = {
    operational: "Operational",
    degraded: "Degraded",
    down: "Down",
  };

  // Compute summary stats from latency data
  let avgP50 = $derived(
    latencyData.length > 0
      ? Math.round(
          latencyData.reduce((s, d) => s + (d.p50_ms || 0), 0) /
            latencyData.length,
        )
      : 0,
  );
  let avgP95 = $derived(
    latencyData.length > 0
      ? Math.round(
          latencyData.reduce((s, d) => s + (d.p95_ms || 0), 0) /
            latencyData.length,
        )
      : 0,
  );

  // Get unique regions from recent data
  let regions = $derived([
    ...new Set(latencyData.map((d) => d.region).filter(Boolean)),
  ]);

  // Real-time subscription
  $effect(() => {
    const url = data.supabaseUrl;
    const key = data.supabaseAnonKey;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const channel = supabase
      .channel(`api-detail-${api.slug}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "apis",
          filter: `id=eq.${api.id}`,
        },
        (payload) => {
          api = { ...api, ...payload.new };
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  });

  function formatDate(iso) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  async function reportIssue() {
    reportSubmitting = true;
    reportMessage = "";
    try {
      const res = await fetch(`${ingestUrl}/v1/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_slug: api.slug }),
      });
      const body = await res.json();
      if (res.ok) {
        reportMessage = "Report submitted. Thank you!";
      } else {
        reportMessage = body.error || "Failed to submit report.";
      }
    } catch {
      reportMessage = "Network error. Try again later.";
    }
    reportSubmitting = false;
  }

  async function subscribe() {
    subSubmitting = true;
    subMessage = "";
    try {
      const res = await fetch(`${ingestUrl}/v1/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_slug: api.slug,
          channel: "email",
          destination: subEmail,
        }),
      });
      const body = await res.json();
      if (res.ok) {
        subMessage =
          body.status === "already_subscribed"
            ? "You are already subscribed."
            : "Subscribed! You will receive alerts for this API.";
        subEmail = "";
      } else {
        subMessage = body.error || "Failed to subscribe.";
      }
    } catch {
      subMessage = "Network error. Try again later.";
    }
    subSubmitting = false;
  }
  let seoTitle = $derived(
    api.current_status === "down" || api.current_status === "degraded"
      ? `🚨 ${api.current_status === 'down' ? 'DOWN' : 'DEGRADED'}: ${api.name} API Outage — Live Status | APIdown`
      : `Is ${api.name} Down? — Real-Time API Status, Uptime & Latency | APIdown`,
  );

  let seoDescription = $derived(
    api.current_status === "down" || api.current_status === "degraded"
      ? `${api.name} API is currently ${api.current_status}. Live error rates, latency data, and incident updates from real production traffic. Check if ${api.name} is down right now.`
      : `Real-time ${api.name} API status: ${data.uptimePercent}% uptime over 90 days, ${avgP50}ms avg latency. Crowd-sourced monitoring from real production traffic. Is ${api.name} down? Check live status, outage history, and SLA data.`,
  );

  // Canonical URL
  let canonicalUrl = $derived(`https://apidown.net/api/${api.slug}`);

  // WebPage + MonitoringAction schema
  let webPageSchema = $derived({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `https://apidown.net/api/${api.slug}#webpage`,
    name: `${api.name} API Status`,
    description: seoDescription,
    url: canonicalUrl,
    dateModified: api.updated_at || new Date().toISOString(),
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      "@id": "https://apidown.net/#website",
      name: "APIdown.net",
      url: "https://apidown.net",
    },
    about: {
      "@type": "SoftwareApplication",
      name: `${api.name} API`,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      ...(api.base_url ? { url: api.base_url } : {}),
    },
    mainEntity: {
      "@type": "MonitorAction",
      name: `${api.name} API Monitoring`,
      agent: {
        "@type": "Organization",
        name: "APIdown.net",
        url: "https://apidown.net",
      },
      object: {
        "@type": "SoftwareApplication",
        name: `${api.name} API`,
      },
    },
    breadcrumb: { "@id": `https://apidown.net/api/${api.slug}#breadcrumb` },
    publisher: {
      "@type": "Organization",
      name: "APIdown.net",
      url: "https://apidown.net",
      logo: {
        "@type": "ImageObject",
        url: "https://apidown.net/logo-primary.png",
      },
    },
  });

  // BreadcrumbList schema
  let breadcrumbSchema = $derived({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `https://apidown.net/api/${api.slug}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "API Status Dashboard",
        item: "https://apidown.net",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `${api.name} Status`,
        item: canonicalUrl,
      },
    ],
  });

  // FAQPage schema — AI search and featured snippet bait
  let faqSchema = $derived({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `https://apidown.net/api/${api.slug}#faq`,
    mainEntity: [
      {
        "@type": "Question",
        name: `Is ${api.name} down right now?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: api.current_status === "operational"
            ? `No, ${api.name} API is currently operational with ${data.uptimePercent}% uptime over the last 90 days and an average latency of ${avgP50}ms. Check real-time status at https://apidown.net/api/${api.slug}`
            : `Yes, ${api.name} API is currently experiencing issues (status: ${api.current_status}). ${incidents.length > 0 ? `Latest incident: ${incidents[0].title}. ` : ''}Check https://apidown.net/api/${api.slug} for live updates.`,
        },
      },
      {
        "@type": "Question",
        name: `What is the ${api.name} API uptime?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${api.name} API has ${data.uptimePercent}% uptime over the last 90 days, measured from real production traffic across multiple regions. Historical uptime data and SLA reports are available at https://apidown.net/api/${api.slug}`,
        },
      },
      {
        "@type": "Question",
        name: `How do I check if ${api.name} API is working?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `You can check ${api.name} API status in real-time at https://apidown.net/api/${api.slug}. APIdown monitors ${api.name} using crowd-sourced data from real production traffic — not synthetic pings — so you see the actual developer experience. You can also subscribe to email alerts for instant notifications.`,
        },
      },
      {
        "@type": "Question",
        name: `What is the average ${api.name} API latency?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Based on the last 24 hours of production traffic, ${api.name} API has a median (P50) latency of ${avgP50}ms and a P95 latency of ${avgP95}ms. Real-time latency charts and regional breakdowns are available at https://apidown.net/api/${api.slug}`,
        },
      },
      ...(incidents.length > 0 ? [{
        "@type": "Question",
        name: `Has ${api.name} had any recent outages?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${api.name} has had ${incidents.length} recorded incident${incidents.length === 1 ? '' : 's'}. The most recent was "${incidents[0].title}" (${incidents[0].severity} severity) on ${new Date(incidents[0].started_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. View full incident history at https://apidown.net/api/${api.slug}`,
        },
      }] : [{
        "@type": "Question",
        name: `Has ${api.name} had any recent outages?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `No, ${api.name} API has had no recorded incidents. It is currently operational with ${data.uptimePercent}% uptime over the last 90 days.`,
        },
      }]),
    ],
  });

  // All schemas combined
  let allSchemas = $derived([webPageSchema, breadcrumbSchema, faqSchema]);

  // Alternate links
  let alternateLinks = $derived([
    { type: "text/plain", href: `https://apidown.net/api/${api.slug}.txt`, title: `${api.name} API Status (Plain Text)` },
    { type: "application/json", href: `https://apidown.net/api-status/${api.slug}`, title: `${api.name} API Status (JSON)` },
  ]);
</script>

<SEO
  title={seoTitle}
  description={seoDescription}
  canonical={canonicalUrl}
  type="article"
  schema={allSchemas}
  alternates={alternateLinks}
/>

<a href="/" class="back">&larr; All APIs</a>

<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">API Status Dashboard</a></li>
    <li aria-current="page">{api.name} Status</li>
  </ol>
</nav>

<article itemscope itemtype="https://schema.org/WebPage">
<div class="api-header">
  <div class="api-info">
    {#if api.logo_url && !logoFailed}
      <img
        src={api.logo_url}
        alt={api.name}
        class="logo"
        onerror={() => (logoFailed = true)}
      />
    {:else}
      <div class="logo-placeholder">{api.name[0]}</div>
    {/if}
    <div>
      <h1>{api.name}</h1>
      <span class="category">{api.category}</span>
    </div>
  </div>
  <div
    class="status-badge"
    style="background: {statusColors[api.current_status]}"
  >
    {statusLabels[api.current_status]}
  </div>
</div>

<div class="conversion-cta">
  <strong
    >Don't let your customers find out about downtime before you do.</strong
  >
  <span
    >Monitor your own internal APIs privately using the exact same real-traffic
    telemetry.</span
  >
  <a href="/pricing" class="pro-btn">Get APIDown Pro</a>
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
    <span class="metric-value">{regions.length || "—"}</span>
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
  <p class="vendor-link">
    Vendor status page: <a href={api.status_page} target="_blank" rel="noopener"
      >{api.status_page}</a
    >
  </p>
{/if}

<p class="sla-link">
  <a href="/api-status/{api.slug}/sla" target="_blank"
    >Download SLA Report (JSON)</a
  >
</p>

<div class="actions-row">
  <div class="action-card">
    <h3>Report an Issue</h3>
    <p>
      Seeing problems with {api.name}? Submit a manual report to help the
      community.
    </p>
    <button onclick={reportIssue} disabled={reportSubmitting}>
      {reportSubmitting ? "Submitting..." : "Report Issue"}
    </button>
    {#if reportMessage}
      <p class="action-message">{reportMessage}</p>
    {/if}
  </div>

  <div class="action-card">
    <h3>Get Alerts</h3>
    <p>Receive email notifications when {api.name} status changes.</p>
    {#if !showSubscribe}
      <button onclick={() => (showSubscribe = true)}>Subscribe</button>
    {:else}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          subscribe();
        }}
      >
        <input
          type="email"
          placeholder="you@example.com"
          bind:value={subEmail}
          required
        />
        <button type="submit" disabled={subSubmitting}>
          {subSubmitting ? "Subscribing..." : "Subscribe"}
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
          <span class="severity severity-{incident.severity}"
            >{incident.severity}</span
          >
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

<section class="faq-section">
  <h2>Frequently Asked Questions</h2>

  <div class="faq-item">
    <h3>Is {api.name} down right now?</h3>
    {#if api.current_status === 'operational'}
      <p>No, {api.name} API is currently <strong>operational</strong> with {data.uptimePercent}% uptime over the last 90 days and an average latency of {avgP50}ms. This page updates in real-time using data from production traffic.</p>
    {:else}
      <p>Yes, {api.name} API is currently experiencing issues — status: <strong>{statusLabels[api.current_status]}</strong>.{#if incidents.length > 0} Latest incident: {incidents[0].title}.{/if} This page updates in real-time.</p>
    {/if}
  </div>

  <div class="faq-item">
    <h3>What is the {api.name} API uptime?</h3>
    <p>{api.name} API has <strong>{data.uptimePercent}% uptime</strong> over the last 90 days, measured from real production traffic across multiple regions. You can download detailed <a href="/api-status/{api.slug}/sla">SLA reports</a> for compliance documentation.</p>
  </div>

  <div class="faq-item">
    <h3>How do I check if {api.name} API is working?</h3>
    <p>APIdown monitors {api.name} using crowd-sourced data from real developer traffic — not synthetic pings. This means you see the actual experience developers have calling the API. You can also <a href="/pricing">subscribe to email alerts</a> for instant outage notifications.</p>
  </div>

  <div class="faq-item">
    <h3>What is the average {api.name} API latency?</h3>
    <p>Based on the last 24 hours of production traffic, {api.name} API has a <strong>median (P50) latency of {avgP50}ms</strong> and a <strong>P95 latency of {avgP95}ms</strong>. View the charts above for regional breakdowns and trends.</p>
  </div>

  {#if incidents.length > 0}
    <div class="faq-item">
      <h3>Has {api.name} had any recent outages?</h3>
      <p>{api.name} has had {incidents.length} recorded incident{incidents.length === 1 ? '' : 's'}. The most recent was "{incidents[0].title}" ({incidents[0].severity} severity) on {formatDate(incidents[0].started_at)}.</p>
    </div>
  {:else}
    <div class="faq-item">
      <h3>Has {api.name} had any recent outages?</h3>
      <p>No, {api.name} API has had no recorded incidents. It is currently operational with {data.uptimePercent}% uptime over the last 90 days.</p>
    </div>
  {/if}
</section>

<footer class="page-footer">
  <p>Data sourced from real production API traffic. Updated in real-time. <a href="/api/{api.slug}.txt">View as plain text</a> &middot; <a href="/api-status/{api.slug}">JSON API</a> &middot; <a href="/api-status/{api.slug}/sla">SLA Report</a></p>
</footer>
</article>

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

  .conversion-cta {
    background: linear-gradient(
      135deg,
      rgba(26, 86, 160, 0.1),
      rgba(26, 86, 160, 0.05)
    );
    border: 1px solid var(--color-primary);
    border-radius: 10px;
    padding: 1.25rem;
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .conversion-cta strong {
    font-size: 1.05rem;
    color: var(--color-text);
  }

  .conversion-cta span {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  .conversion-cta .pro-btn {
    align-self: flex-start;
    background: var(--color-primary);
    color: white;
    padding: 0.5rem 1.25rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9rem;
    transition: opacity 0.2s;
  }

  .conversion-cta .pro-btn:hover {
    opacity: 0.9;
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

  .logo-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 700;
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

  .action-card button:hover {
    opacity: 0.85;
  }
  .action-card button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

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
    .actions-row {
      grid-template-columns: 1fr;
    }
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

  .severity-minor {
    background: var(--color-degraded);
    color: #000;
  }
  .severity-major {
    background: #f97316;
    color: #000;
  }
  .severity-critical {
    background: var(--color-down);
    color: #fff;
  }

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

  /* Breadcrumb */
  .breadcrumb {
    margin-bottom: 1rem;
  }

  .breadcrumb ol {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .breadcrumb li:not(:last-child)::after {
    content: '›';
    margin-left: 0.35rem;
  }

  .breadcrumb a {
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .breadcrumb a:hover {
    color: var(--color-primary);
  }

  /* FAQ Section */
  .faq-section {
    margin-top: 2.5rem;
    margin-bottom: 2rem;
  }

  .faq-section h2 {
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }

  .faq-item {
    border-bottom: 1px solid var(--color-border);
    padding: 1rem 0;
  }

  .faq-item:last-child {
    border-bottom: none;
  }

  .faq-item h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: var(--color-text);
  }

  .faq-item p {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.6;
  }

  .faq-item a {
    color: var(--color-primary);
  }

  /* Page footer */
  .page-footer {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .page-footer p {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .page-footer a {
    color: var(--color-text-muted);
    text-decoration: underline;
  }
</style>
