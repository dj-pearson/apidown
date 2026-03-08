<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { createClient } from '@supabase/supabase-js';
  import SEO from '$lib/components/SEO.svelte';

  let { data } = $props();
  let incidents = $state(data.incidents);
  let totalCount = $state(data.totalCount);
  let currentPage = $state(data.page);
  let pageSize = data.pageSize;
  let loadingMore = $state(false);
  let liveIndicator = $state('connecting');

  // Initialize filters from URL query params
  let filterSeverity = $state(page.url.searchParams.get('severity') || 'all');
  let filterStatus = $state(page.url.searchParams.get('status') || 'all');
  let filterDateRange = $state(page.url.searchParams.get('range') || 'all');
  let searchQuery = $state(page.url.searchParams.get('q') || '');

  // Update state when data changes (navigation)
  $effect(() => {
    incidents = data.incidents;
    totalCount = data.totalCount;
    currentPage = data.page;
  });

  // Real-time subscription for incident changes
  $effect(() => {
    const url = data.supabaseUrl;
    const key = data.supabaseAnonKey;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const channel = supabase
      .channel('incidents-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, (payload) => {
        // Prepend new incident to list
        const newInc = { ...payload.new, apis: { name: 'Loading...', slug: '' }, report_count: 0 };
        incidents = [newInc, ...incidents];
        totalCount++;
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, (payload) => {
        // Update existing incident in list
        incidents = incidents.map(inc =>
          inc.id === payload.new.id ? { ...inc, ...payload.new } : inc
        );
      })
      .subscribe((status) => {
        liveIndicator = status === 'SUBSCRIBED' ? 'live' : 'connecting';
      });

    return () => {
      supabase.removeChannel(channel);
    };
  });

  // Persist filter state to URL without triggering navigation
  function updateFilterUrl() {
    const url = new URL(window.location.href);
    if (filterSeverity !== 'all') url.searchParams.set('severity', filterSeverity);
    else url.searchParams.delete('severity');
    if (filterStatus !== 'all') url.searchParams.set('status', filterStatus);
    else url.searchParams.delete('status');
    if (filterDateRange !== 'all') url.searchParams.set('range', filterDateRange);
    else url.searchParams.delete('range');
    if (searchQuery) url.searchParams.set('q', searchQuery);
    else url.searchParams.delete('q');
    url.searchParams.delete('page');
    history.replaceState(null, '', url.toString());
  }

  // Debounce search query URL updates
  let searchTimeout;
  function onSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(updateFilterUrl, 300);
  }

  let filteredIncidents = $derived.by(() => {
    return incidents.filter(inc => {
      if (filterSeverity !== 'all' && inc.severity !== filterSeverity) return false;
      if (filterStatus === 'active' && inc.status === 'resolved') return false;
      if (filterStatus === 'resolved' && inc.status !== 'resolved') return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesApi = (inc.apis?.name || '').toLowerCase().includes(q);
        const matchesTitle = (inc.title || '').toLowerCase().includes(q);
        if (!matchesApi && !matchesTitle) return false;
      }
      if (filterDateRange !== 'all') {
        const days = { '7d': 7, '30d': 30, '90d': 90 }[filterDateRange] || 0;
        if (days > 0) {
          const cutoff = Date.now() - days * 86400000;
          if (new Date(inc.started_at).getTime() < cutoff) return false;
        }
      }
      return true;
    });
  });

  let filteredCount = $derived(filteredIncidents.length);

  let displayedCount = $derived(incidents.length);
  let hasMore = $derived(currentPage * pageSize < totalCount);

  async function loadMore() {
    loadingMore = true;
    const nextPage = currentPage + 1;
    await goto(`/incidents?page=${nextPage}`, { replaceState: false, noScroll: true });
    loadingMore = false;
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  }
</script>

<SEO
  title="API Incidents — APIdown.net"
  description="Active and recent API incidents detected from real production traffic. View outage timelines, affected regions, and resolution status for {totalCount} tracked incidents."
  canonical="https://apidown.net/incidents"
  alternates={[{ type: 'application/rss+xml', href: '/incidents/rss', title: 'APIdown.net Incident Feed' }]}
  schema={[
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "API Incidents — APIdown.net",
      "description": "Active and recent API incidents detected from real production traffic",
      "url": "https://apidown.net/incidents",
      "isPartOf": { "@type": "WebSite", "name": "APIdown.net", "url": "https://apidown.net" }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://apidown.net" },
        { "@type": "ListItem", "position": 2, "name": "Incidents", "item": "https://apidown.net/incidents" }
      ]
    }
  ]}
/>

<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li aria-current="page">Incidents</li>
  </ol>
</nav>

<div class="incidents-header">
  <div>
    <h1>Incidents <span class="live-dot" class:live={liveIndicator === 'live'} title={liveIndicator === 'live' ? 'Live updates active' : 'Connecting...'}></span></h1>
    <p class="subtitle">Active and recent incidents across all monitored APIs</p>
  </div>
  <a href="/incidents/rss" class="rss-link" aria-label="RSS Feed" title="Subscribe to RSS Feed">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.18 15.64a2.18 2.18 0 010 4.36 2.18 2.18 0 010-4.36M4 4.44A15.56 15.56 0 0119.56 20h-2.83A12.73 12.73 0 004 7.27V4.44m0 5.66a9.9 9.9 0 019.9 9.9h-2.83A7.07 7.07 0 004 12.93V10.1z"/></svg>
    RSS
  </a>
</div>

{#if totalCount === 0}
  <div class="empty-state">
    <p>No incidents recorded yet. All systems operational.</p>
    <p class="empty-timestamp">As of {formatDate(new Date().toISOString())}</p>
  </div>
{:else}
  <div class="filters" role="toolbar" aria-label="Incident filters">
    <div class="filter-group search-group">
      <input type="text" placeholder="Search by API or incident title..." bind:value={searchQuery} oninput={onSearchInput} aria-label="Search incidents" class="search-input" />
    </div>
    <div class="filter-group">
      <label for="severity-filter">Severity</label>
      <select id="severity-filter" bind:value={filterSeverity} onchange={updateFilterUrl}>
        <option value="all">All</option>
        <option value="critical">Critical</option>
        <option value="major">Major</option>
        <option value="minor">Minor</option>
      </select>
    </div>
    <div class="filter-group">
      <label for="status-filter">Status</label>
      <select id="status-filter" bind:value={filterStatus} onchange={updateFilterUrl}>
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="resolved">Resolved</option>
      </select>
    </div>
    <div class="filter-group">
      <label for="date-filter">Period</label>
      <select id="date-filter" bind:value={filterDateRange} onchange={updateFilterUrl}>
        <option value="all">All time</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
      </select>
    </div>
    <span class="filter-count">Showing {filteredCount} of {totalCount} incidents</span>
  </div>

  {#if filteredIncidents.length === 0}
    <div class="empty-state">
      <p>No incidents match the selected filters.</p>
      <button class="clear-filters" onclick={() => { filterSeverity = 'all'; filterStatus = 'all'; filterDateRange = 'all'; searchQuery = ''; updateFilterUrl(); }}>Clear filters</button>
    </div>
  {:else}
    <div class="incidents-list">
      {#each filteredIncidents as incident (incident.id)}
        <a href="/incidents/{incident.id}" class="incident-card" aria-label="{incident.title} — {incident.apis?.name || 'Unknown'}">
          <div class="incident-header">
            <span class="severity severity-{incident.severity}">{incident.severity}</span>
            <span class="api-name">{incident.apis?.name || 'Unknown'}</span>
            <span class="incident-status status-{incident.status}">{incident.status}</span>
          </div>
          <h3>{incident.title}</h3>
          <div class="incident-footer">
            <span>Started {formatDate(incident.started_at)}</span>
            {#if incident.resolved_at}
              <span>· Resolved {formatDate(incident.resolved_at)}</span>
            {/if}
            {#if incident.report_count > 0}
              <span>· {incident.report_count} report{incident.report_count !== 1 ? 's' : ''}</span>
            {/if}
            {#if incident.regions?.length > 0}
              <span>· Regions: {incident.regions.join(', ')}</span>
            {/if}
          </div>
        </a>
      {/each}
    </div>

    {#if hasMore}
      <div class="load-more">
        <button class="load-more-btn" disabled={loadingMore} onclick={loadMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      </div>
    {/if}
  {/if}
{/if}

<style>
  .incidents-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-muted);
    display: inline-block;
    flex-shrink: 0;
  }

  .live-dot.live {
    background: var(--color-operational);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .subtitle {
    color: var(--color-text-muted);
  }

  .rss-link {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    font-weight: 600;
    text-decoration: none;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .rss-link:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
    text-decoration: none;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border-radius: 12px;
    border: 1px solid var(--color-border);
  }

  .incidents-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .incident-card {
    padding: 1rem 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    text-decoration: none;
    transition: border-color 0.15s;
  }

  .incident-card:hover {
    border-color: var(--color-primary);
    text-decoration: none;
  }

  .incident-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .severity {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .severity-minor { background: var(--color-degraded); color: #000; }
  .severity-major { background: #f97316; color: #000; }
  .severity-critical { background: var(--color-down); color: #fff; }

  .api-name {
    color: var(--color-text);
    font-weight: 600;
    font-size: 0.85rem;
  }

  .incident-status {
    margin-left: auto;
    font-size: 0.75rem;
    text-transform: capitalize;
    color: var(--color-text-muted);
  }

  h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 0.5rem;
  }

  .incident-footer {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .empty-timestamp {
    font-size: 0.8rem;
    margin-top: 0.5rem;
    opacity: 0.7;
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .filter-group label {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .filter-group select {
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.8rem;
    cursor: pointer;
  }

  .filter-group select:focus {
    border-color: var(--color-primary);
    outline: none;
  }

  .filter-count {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-left: auto;
  }

  .clear-filters {
    margin-top: 1rem;
    background: none;
    border: 1px solid var(--color-border);
    color: var(--color-primary);
    padding: 0.4rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .clear-filters:hover {
    border-color: var(--color-primary);
  }

  .load-more {
    text-align: center;
    margin-top: 1.5rem;
  }

  .load-more-btn {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-primary);
    padding: 0.6rem 2rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .load-more-btn:hover {
    border-color: var(--color-primary);
  }

  .load-more-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .breadcrumb { margin-bottom: 1rem; }
  .breadcrumb ol { list-style: none; padding: 0; margin: 0; display: flex; gap: 0.35rem; font-size: 0.8rem; color: var(--color-text-muted); }
  .breadcrumb li:not(:last-child)::after { content: '\203A'; margin-left: 0.35rem; }
  .breadcrumb a { color: var(--color-text-muted); text-decoration: none; }
  .breadcrumb a:hover { color: var(--color-primary); }

  .search-group { flex: 1; min-width: 200px; }

  .search-input {
    width: 100%;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.85rem;
    outline: none;
  }

  .search-input:focus { border-color: var(--color-primary); }

  @media (max-width: 640px) {
    .filters { flex-direction: column; align-items: stretch; }
    .filter-count { text-align: center; }
  }
</style>
