<script>
  import { createClient } from '@supabase/supabase-js';
  import SEO from '$lib/components/SEO.svelte';
  import {
    emptyPatchSet, withPatch, mergePatches,
    emptyAdditions, withAddition, mergeAdditions,
  } from '$lib/live-patch.js';

  let { data } = $props();

  // The radar renders straight off `data`, with live activity layered on top as
  // patches tagged to this payload — so switching category filter (or any other
  // load) shows the new feed instead of the one this component mounted with.
  let statusPatches = $state(emptyPatchSet());
  let liveEvents = $state(emptyAdditions());

  let apis = $derived(mergePatches(data.apis, statusPatches));
  let events = $derived(mergeAdditions(data.events, liveEvents, { key: 'key', limit: 200 }));
  // Only 'opened' events raise the counter — the feed also carries status
  // changes and resolutions.
  let openedLast24h = $derived.by(() => {
    const seeded = new Set(data.events.map(e => e.key));
    const newlyOpened = events.filter(e => e.type === 'opened' && !seeded.has(e.key)).length;
    return data.openedLast24h + newlyOpened;
  });

  let connectionStatus = $state('connecting');
  let now = $state(Date.now());
  let recentKeys = $state(new Set());

  let downApis = $derived(apis.filter(a => a.current_status === 'down'));
  let degradedApis = $derived(apis.filter(a => a.current_status === 'degraded'));

  // Tick so relative timestamps stay honest without a full reload.
  $effect(() => {
    const t = setInterval(() => now = Date.now(), 30_000);
    return () => clearInterval(t);
  });

  function relative(iso) {
    const diff = Math.max(0, now - new Date(iso).getTime());
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function markRecent(key) {
    recentKeys = new Set([...recentKeys, key]);
    setTimeout(() => {
      const next = new Set(recentKeys);
      next.delete(key);
      recentKeys = next;
    }, 20_000);
  }

  function pushEvent(evt) {
    if (events.some(e => e.key === evt.key)) return;
    liveEvents = withAddition(liveEvents, data.events, evt, 'key');
    markRecent(evt.key);
  }

  function apiFor(apiId) {
    return apis.find(a => a.id === apiId);
  }

  $effect(() => {
    const url = data.supabaseUrl;
    const key = data.supabaseAnonKey;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const channel = supabase
      .channel('live-radar')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'apis' }, (payload) => {
        const existing = apis.find(a => a.id === payload.new.id);
        if (!existing) return; // outside the current category filter
        if (existing.current_status !== payload.new.current_status) {
          pushEvent({
            key: `status-${payload.new.id}-${payload.new.current_status}-${Date.now()}`,
            type: 'status',
            at: new Date().toISOString(),
            apiName: existing.name,
            apiSlug: existing.slug,
            severity: null,
            title: `Status changed from ${existing.current_status} to ${payload.new.current_status}`,
            incidentId: null,
          });
        }
        statusPatches = withPatch(statusPatches, data.apis, payload.new);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, (payload) => {
        const api = apiFor(payload.new.api_id);
        if (!api) return;
        // The counter derives from the 'opened' events below — no manual bump.
        pushEvent({
          key: `open-${payload.new.id}`,
          type: 'opened',
          at: payload.new.started_at || new Date().toISOString(),
          apiName: api.name,
          apiSlug: api.slug,
          severity: payload.new.severity,
          title: payload.new.title,
          incidentId: payload.new.id,
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, (payload) => {
        const api = apiFor(payload.new.api_id);
        if (!api) return;
        if (payload.new.status === 'resolved' && payload.old?.status !== 'resolved') {
          pushEvent({
            key: `resolved-${payload.new.id}`,
            type: 'resolved',
            at: payload.new.resolved_at || new Date().toISOString(),
            apiName: api.name,
            apiSlug: api.slug,
            severity: payload.new.severity,
            title: payload.new.title,
            incidentId: payload.new.id,
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') connectionStatus = 'live';
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') connectionStatus = 'offline';
        else connectionStatus = 'connecting';
      });

    return () => supabase.removeChannel(channel);
  });

  const typeLabels = {
    opened: 'Incident opened',
    resolved: 'Resolved',
    update: 'Update',
    status: 'Status change',
  };
</script>

<SEO
  title="Live API Outage Radar — real-time incident feed | APIdown.net"
  description="A continuously updating feed of API status changes and incidents. Leave it open on a second monitor during your next deploy."
  canonical="https://apidown.net/live"
/>

<div class="radar-head">
  <div>
    <h1>Live Radar</h1>
    <p class="sub">
      Every status change and incident across {apis.length} {data.categoryLabel ? `${data.categoryLabel} ` : ''}APIs,
      as it happens. Built to be left open on a second monitor.
    </p>
  </div>
  <span class="conn conn-{connectionStatus}">
    <span class="conn-dot"></span>
    {connectionStatus === 'live' ? 'Live' : connectionStatus === 'offline' ? 'Reconnecting' : 'Connecting'}
  </span>
</div>

<div class="counters">
  <div class="counter" class:alert={downApis.length > 0}>
    <span class="counter-value">{downApis.length}</span>
    <span class="counter-label">Down</span>
  </div>
  <div class="counter" class:warn={degradedApis.length > 0}>
    <span class="counter-value">{degradedApis.length}</span>
    <span class="counter-label">Degraded</span>
  </div>
  <div class="counter">
    <span class="counter-value">{openedLast24h}</span>
    <span class="counter-label">Incidents opened (24h)</span>
  </div>
  <div class="counter">
    <span class="counter-value">{apis.length - downApis.length - degradedApis.length}</span>
    <span class="counter-label">Operational</span>
  </div>
</div>

{#if downApis.length > 0 || degradedApis.length > 0}
  <div class="affected">
    {#each [...downApis, ...degradedApis] as api (api.slug)}
      <a href="/api/{api.slug}" class="affected-chip chip-{api.current_status}">
        <span class="dot"></span>{api.name}
      </a>
    {/each}
  </div>
{/if}

<div class="filters">
  <a href="/live" class="filter" class:active={!data.category}>All</a>
  {#each data.categories as c (c.slug)}
    <a href="/live?category={c.slug}" class="filter" class:active={data.category === c.slug}>{c.label}</a>
  {/each}
</div>

<section class="feed-wrap" aria-label="Live event feed">
  <div class="feed" aria-live="polite" aria-relevant="additions">
    {#each events as evt (evt.key)}
      <article class="event event-{evt.type}" class:fresh={recentKeys.has(evt.key)}>
        <span class="event-marker" aria-hidden="true"></span>
        <div class="event-body">
          <div class="event-top">
            <a href="/api/{evt.apiSlug}" class="event-api">{evt.apiName}</a>
            <span class="event-type">{typeLabels[evt.type]}</span>
            {#if evt.severity}
              <span class="sev sev-{evt.severity}">{evt.severity}</span>
            {/if}
            <time datetime={evt.at} title={new Date(evt.at).toLocaleString()}>{relative(evt.at)}</time>
          </div>
          <p class="event-title">
            {#if evt.incidentId}
              <a href="/incidents/{evt.incidentId}">{evt.title}</a>
            {:else}
              {evt.title}
            {/if}
          </p>
        </div>
      </article>
    {:else}
      <p class="feed-empty">
        No incident activity in the last 48 hours{data.categoryLabel ? ` for ${data.categoryLabel}` : ''}.
        New events appear here the moment they're detected.
      </p>
    {/each}
  </div>
</section>

<style>
  .radar-head {
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

  .conn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.25rem 0.65rem;
  }

  .conn-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-text-muted);
  }

  .conn-live .conn-dot {
    background: var(--color-operational);
    animation: pulse 2s ease-in-out infinite;
  }

  .conn-offline .conn-dot { background: var(--color-down); }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  .counters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .counter {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.9rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .counter.alert { border-color: color-mix(in srgb, var(--color-down) 55%, transparent); }
  .counter.alert .counter-value { color: var(--color-down); }
  .counter.warn { border-color: color-mix(in srgb, var(--color-degraded) 50%, transparent); }
  .counter.warn .counter-value { color: var(--color-degraded); }

  .counter-value {
    font-size: 1.75rem;
    font-weight: 700;
    font-family: var(--font-mono);
    line-height: 1;
  }

  .counter-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  .affected {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .affected-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border-radius: 999px;
    padding: 0.3rem 0.75rem;
    font-size: 0.82rem;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    text-decoration: none;
    color: var(--color-text);
  }

  .affected-chip .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .chip-down { border-color: color-mix(in srgb, var(--color-down) 55%, transparent); }
  .chip-down .dot { background: var(--color-down); }
  .chip-degraded { border-color: color-mix(in srgb, var(--color-degraded) 50%, transparent); }
  .chip-degraded .dot { background: var(--color-degraded); }

  .filters {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .filter {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.25rem 0.7rem;
    text-decoration: none;
  }

  .filter:hover {
    color: var(--color-text);
    text-decoration: none;
  }

  .filter.active {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .feed {
    display: flex;
    flex-direction: column;
  }

  .event {
    display: flex;
    gap: 0.85rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--color-border);
  }

  .event-marker {
    width: 3px;
    border-radius: 2px;
    background: var(--color-border);
    flex-shrink: 0;
  }

  .event-opened .event-marker { background: var(--color-down); }
  .event-resolved .event-marker { background: var(--color-operational); }
  .event-update .event-marker { background: var(--color-primary); }
  .event-status .event-marker { background: var(--color-degraded); }

  .event.fresh {
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    animation: flash 1.2s ease-out;
  }

  @keyframes flash {
    from { background: color-mix(in srgb, var(--color-primary) 22%, transparent); }
    to { background: color-mix(in srgb, var(--color-primary) 8%, transparent); }
  }

  .event-body { flex: 1; min-width: 0; }

  .event-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.2rem;
  }

  .event-api {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--color-text);
    text-decoration: none;
  }

  .event-api:hover { color: var(--color-primary); }

  .event-type {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .event-top time {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .event-title {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .event-title a { color: var(--color-text-muted); }
  .event-title a:hover { color: var(--color-primary); }

  .feed-empty {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    padding: 2rem 0;
    line-height: 1.6;
  }

  .sev {
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .sev-critical { background: rgba(239, 68, 68, 0.15); color: var(--color-down); }
  .sev-major { background: rgba(245, 158, 11, 0.15); color: var(--color-degraded); }
  .sev-minor { background: rgba(148, 163, 184, 0.15); color: var(--color-text-muted); }

  @media (prefers-reduced-motion: reduce) {
    .conn-live .conn-dot,
    .event.fresh {
      animation: none;
    }
  }
</style>
