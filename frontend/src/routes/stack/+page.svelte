<script>
  import { categoryLabel } from '$lib/categories.js';
  import { createClient } from '@supabase/supabase-js';
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import StatusCard from '$lib/components/StatusCard.svelte';
  import SEO from '$lib/components/SEO.svelte';

  let { data } = $props();

  const STORAGE_KEY = 'apidown-stack';

  const STARTER_STACKS = [
    { label: 'AI stack', slugs: ['openai', 'anthropic', 'google-gemini', 'pinecone', 'replicate'] },
    { label: 'Payments stack', slugs: ['stripe', 'paypal', 'plaid', 'shopify'] },
    { label: 'Cloud stack', slugs: ['aws-s3', 'aws-ec2', 'cloudflare', 'vercel', 'github'] },
    { label: 'Comms stack', slugs: ['twilio', 'sendgrid', 'slack', 'discord'] },
  ];


  let apis = $state(data.apis);
  let sparklineData = data.sparklineData || {};

  // URL wins over localStorage so a shared link always shows the sender's stack.
  const urlSlugs = (page.url.searchParams.get('apis') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let selected = $state(urlSlugs);
  let hydrated = $state(false);
  let pickerQuery = $state('');
  let pickerOpen = $state(false);
  let copied = $state(false);
  let connectionStatus = $state('connecting');

  // Load from localStorage only when the URL did not specify a stack.
  $effect(() => {
    if (hydrated) return;
    hydrated = true;
    if (urlSlugs.length > 0) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved) && saved.length) selected = saved.filter(s => typeof s === 'string');
    } catch {
      // Corrupt value — start from an empty stack rather than failing the page.
    }
  });

  // Persist and mirror into the URL so the page stays shareable and bookmarkable.
  $effect(() => {
    if (!hydrated) return;
    const slugs = selected;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
    } catch {
      // Private browsing / storage disabled — the URL still carries the stack.
    }
    const url = new URL(page.url);
    if (slugs.length) url.searchParams.set('apis', slugs.join(','));
    else url.searchParams.delete('apis');
    if (url.href !== page.url.href) replaceState(url, {});
  });

  let bySlug = $derived.by(() => {
    const m = {};
    for (const a of apis) m[a.slug] = a;
    return m;
  });

  let stackApis = $derived(selected.map(s => bySlug[s]).filter(Boolean));

  let incidentsByApi = $derived.by(() => {
    const m = {};
    for (const inc of data.openIncidents || []) {
      m[inc.api_id] ??= [];
      m[inc.api_id].push(inc);
    }
    return m;
  });

  let downCount = $derived(stackApis.filter(a => a.current_status === 'down').length);
  let degradedCount = $derived(stackApis.filter(a => a.current_status === 'degraded').length);

  let verdict = $derived.by(() => {
    if (stackApis.length === 0) return null;
    if (downCount > 0) {
      const names = stackApis.filter(a => a.current_status === 'down').map(a => a.name);
      return { tone: 'down', text: `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} down` };
    }
    if (degradedCount > 0) {
      const names = stackApis.filter(a => a.current_status === 'degraded').map(a => a.name);
      return { tone: 'degraded', text: `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} degraded` };
    }
    return {
      tone: 'operational',
      text: `All ${stackApis.length} ${stackApis.length === 1 ? 'API' : 'APIs'} in your stack ${stackApis.length === 1 ? 'is' : 'are'} operational`,
    };
  });

  let pickerResults = $derived.by(() => {
    const q = pickerQuery.trim().toLowerCase();
    const available = apis.filter(a => !selected.includes(a.slug));
    if (!q) return available.slice(0, 12);
    return available
      .filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        categoryLabel(a.category).toLowerCase().includes(q)
      )
      .slice(0, 12);
  });

  function add(slug) {
    if (!selected.includes(slug)) selected = [...selected, slug];
    pickerQuery = '';
  }

  function remove(slug) {
    selected = selected.filter(s => s !== slug);
  }

  function applyStarter(slugs) {
    // Only include starters that actually exist in the current API list.
    selected = slugs.filter(s => bySlug[s]);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(page.url.href);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch {
      copied = false;
    }
  }

  // Live status updates for the whole API list; the derived stack follows along.
  $effect(() => {
    const url = data.supabaseUrl;
    const key = data.supabaseAnonKey;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const channel = supabase
      .channel('stack-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'apis' }, (payload) => {
        apis = apis.map(a => (a.id === payload.new.id ? { ...a, ...payload.new } : a));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') connectionStatus = 'live';
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') connectionStatus = 'offline';
        else connectionStatus = 'connecting';
      });

    return () => supabase.removeChannel(channel);
  });
</script>

<SEO
  title="My Stack — Live status for the APIs you actually use | APIdown.net"
  description="Build a personal watchlist of the APIs your product depends on and get one live verdict: is anything in your stack down right now?"
  canonical="https://apidown.net/stack"
/>

<div class="head">
  <div>
    <h1>My Stack</h1>
    <p class="sub">
      The APIs your product actually depends on, on one page. Saved in this browser and
      encoded in the URL — bookmark it or share it with your team. No account needed.
    </p>
  </div>
  {#if stackApis.length > 0}
    <div class="head-actions">
      <span class="conn conn-{connectionStatus}">
        <span class="conn-dot"></span>
        {connectionStatus === 'live' ? 'Live' : connectionStatus === 'offline' ? 'Reconnecting' : 'Connecting'}
      </span>
      <button class="btn-ghost" onclick={copyLink}>{copied ? 'Link copied' : 'Copy share link'}</button>
    </div>
  {/if}
</div>

{#if verdict}
  <div class="verdict verdict-{verdict.tone}" aria-live="polite">
    <span class="verdict-dot"></span>
    <strong>{verdict.text}</strong>
  </div>
{/if}

{#if stackApis.length === 0}
  <div class="empty">
    <h2>Pick the APIs you depend on</h2>
    <p>
      Instead of scanning every API we track, choose your stack once. We'll show you a single
      verdict — and you'll know in one glance whether the problem is theirs or yours.
    </p>
    <div class="starters">
      {#each STARTER_STACKS as s}
        <button class="starter" onclick={() => applyStarter(s.slugs)}>{s.label}</button>
      {/each}
    </div>
    <p class="or">or search below</p>
  </div>
{/if}

<div class="picker">
  <label class="picker-label" for="stack-search">Add an API</label>
  <input
    id="stack-search"
    type="text"
    bind:value={pickerQuery}
    onfocus={() => pickerOpen = true}
    placeholder="Search {apis.length} APIs — Stripe, OpenAI, Twilio…"
    autocomplete="off"
  />
  {#if pickerOpen && pickerResults.length > 0}
    <ul class="picker-results">
      {#each pickerResults as api (api.slug)}
        <li>
          <button onclick={() => add(api.slug)}>
            <span class="dot dot-{api.current_status || 'operational'}"></span>
            <span class="picker-name">{api.name}</span>
            <span class="picker-cat">{categoryLabel(api.category)}</span>
            <span class="picker-add" aria-hidden="true">+</span>
            <span class="sr-only">Add {api.name} to your stack</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if stackApis.length > 0}
  <div class="chips">
    {#each stackApis as api (api.slug)}
      <span class="chip">
        {api.name}
        <button onclick={() => remove(api.slug)} aria-label="Remove {api.name} from your stack">×</button>
      </span>
    {/each}
    <button class="chip-clear" onclick={() => selected = []}>Clear all</button>
  </div>

  <div class="grid">
    {#each stackApis as api (api.slug)}
      <StatusCard {api} sparkline={sparklineData[api.id] || []} />
    {/each}
  </div>

  {#if (data.openIncidents || []).some(i => stackApis.some(a => a.id === i.api_id))}
    <section class="incidents">
      <h2>Open incidents in your stack</h2>
      <ul>
        {#each stackApis as api (api.slug)}
          {#each incidentsByApi[api.id] || [] as inc (inc.id)}
            <li>
              <span class="sev sev-{inc.severity}">{inc.severity}</span>
              <a href="/incidents/{inc.id}">{api.name} — {inc.title}</a>
              <time datetime={inc.started_at}>{new Date(inc.started_at).toLocaleString()}</time>
            </li>
          {/each}
        {/each}
      </ul>
    </section>
  {/if}
{/if}

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  h1 {
    font-size: 1.75rem;
    margin-bottom: 0.4rem;
  }

  .sub {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    max-width: 620px;
    line-height: 1.6;
  }

  .head-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .conn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .conn-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-text-muted);
  }

  .conn-live .conn-dot { background: var(--color-operational); }
  .conn-offline .conn-dot { background: var(--color-down); }

  .btn-ghost {
    background: none;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
  }

  .btn-ghost:hover {
    border-color: var(--color-primary);
    color: var(--color-text);
  }

  .verdict {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.9rem 1.1rem;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    margin-bottom: 1.5rem;
    font-size: 1rem;
  }

  .verdict-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .verdict-operational { border-color: color-mix(in srgb, var(--color-operational) 40%, transparent); }
  .verdict-operational .verdict-dot { background: var(--color-operational); }
  .verdict-degraded { border-color: color-mix(in srgb, var(--color-degraded) 45%, transparent); }
  .verdict-degraded .verdict-dot { background: var(--color-degraded); }
  .verdict-down { border-color: color-mix(in srgb, var(--color-down) 50%, transparent); }
  .verdict-down .verdict-dot { background: var(--color-down); }

  .empty {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .empty h2 {
    font-size: 1.15rem;
    margin-bottom: 0.5rem;
  }

  .empty p {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    max-width: 520px;
    margin: 0 auto 1.25rem;
    line-height: 1.6;
  }

  .starters {
    display: flex;
    gap: 0.6rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .starter {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    border-radius: 999px;
    padding: 0.45rem 1rem;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
  }

  .starter:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .or {
    margin-top: 1.25rem !important;
    margin-bottom: 0 !important;
    font-size: 0.8rem !important;
  }

  .picker {
    position: relative;
    max-width: 460px;
    margin-bottom: 1rem;
  }

  .picker-label {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    margin-bottom: 0.35rem;
  }

  .picker input {
    width: 100%;
    padding: 0.6rem 0.85rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text);
    font-size: 0.9rem;
    font-family: inherit;
    outline: none;
  }

  .picker input:focus {
    border-color: var(--color-primary);
  }

  .picker-results {
    list-style: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 20;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  }

  .picker-results button {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text);
    padding: 0.55rem 0.75rem;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
  }

  .picker-results button:hover {
    background: var(--color-surface-hover);
  }

  .picker-name { flex: 1; }

  .picker-cat {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }

  .picker-add {
    color: var(--color-primary);
    font-weight: 700;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--color-operational);
  }

  .dot-degraded { background: var(--color-degraded); }
  .dot-down { background: var(--color-down); }

  .chips {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.25rem 0.35rem 0.25rem 0.7rem;
    font-size: 0.8rem;
  }

  .chip button {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 0.25rem;
  }

  .chip button:hover { color: var(--color-down); }

  .chip-clear {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    font-family: inherit;
    cursor: pointer;
    text-decoration: underline;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 0.85rem;
    margin-bottom: 2rem;
  }

  .incidents h2 {
    font-size: 1.05rem;
    margin-bottom: 0.75rem;
  }

  .incidents ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .incidents li {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.6rem 0.85rem;
    font-size: 0.85rem;
    flex-wrap: wrap;
  }

  .incidents li a { flex: 1; }

  .incidents time {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }

  .sev {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .sev-critical { background: rgba(239, 68, 68, 0.15); color: var(--color-down); }
  .sev-major { background: rgba(245, 158, 11, 0.15); color: var(--color-degraded); }
  .sev-minor { background: rgba(148, 163, 184, 0.15); color: var(--color-text-muted); }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .head-actions { width: 100%; }
  }
</style>
