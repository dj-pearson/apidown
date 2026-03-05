<script>
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabase.js';
  import StatusCard from '$lib/components/StatusCard.svelte';

  let { data } = $props();
  let apis = $state(data.apis);
  let activeIncidents = $state(data.activeIncidents);
  let searchQuery = $state('');
  let channel;

  // Group APIs by category
  let groupedApis = $derived.by(() => {
    const filtered = searchQuery
      ? apis.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : apis;

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
    auth: 'Auth & Identity',
    database: 'Database / Storage',
    devtools: 'Dev Tools & Hosting',
  };

  let operationalCount = $derived(apis.filter(a => a.current_status === 'operational').length);

  onMount(() => {
    channel = supabase
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
      .subscribe();
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });
</script>

<svelte:head>
  <title>APIdown.net — Real API Status from Real Traffic</title>
  <meta name="description" content="Real-time API health status powered by crowd-sourced production traffic. Is the API actually down — or is it your code?" />
</svelte:head>

<div class="hero">
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

<div class="search-bar">
  <input
    type="text"
    placeholder="Search APIs..."
    bind:value={searchQuery}
  />
</div>

{#each Object.entries(groupedApis) as [category, categoryApis]}
  <section class="category">
    <h2>{categoryLabels[category] || category}</h2>
    <div class="grid">
      {#each categoryApis as api (api.id)}
        <StatusCard {api} />
      {/each}
    </div>
  </section>
{/each}

<style>
  .hero {
    text-align: center;
    margin-bottom: 2rem;
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

  .search-bar {
    margin-bottom: 2rem;
  }

  .search-bar input {
    width: 100%;
    max-width: 400px;
    display: block;
    margin: 0 auto;
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

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 0.75rem;
  }
</style>
