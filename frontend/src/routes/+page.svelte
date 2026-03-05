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
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "APIdown.net",
    "url": "https://apidown.net",
    "description": "Real-time API health status powered by crowd-sourced production traffic",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
  })}</script>`}
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
  <h1>API Status Dashboard</h1>
  <p class="subtitle">Real-time health from real production traffic</p>
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
</style>
