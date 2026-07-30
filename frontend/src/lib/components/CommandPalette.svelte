<script>
  import { goto } from '$app/navigation';

  let { apis = [] } = $props();

  const statusColors = {
    operational: 'var(--color-operational)',
    degraded: 'var(--color-degraded)',
    down: 'var(--color-down)',
  };

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

  const pages = [
    { label: 'Status Dashboard', href: '/', keywords: 'home status grid all apis' },
    { label: 'My Stack', href: '/stack', keywords: 'watchlist favorites personal my stack' },
    { label: 'Live Radar', href: '/live', keywords: 'live radar feed realtime firehose monitor' },
    { label: 'Incidents', href: '/incidents', keywords: 'incidents outages history' },
    { label: 'Leaderboard', href: '/leaderboard', keywords: 'leaderboard ranking reliability grades' },
    { label: 'Compare APIs', href: '/compare', keywords: 'compare versus alternatives' },
    { label: 'Documentation', href: '/docs', keywords: 'docs sdk integration api reference' },
    { label: 'Pricing', href: '/pricing', keywords: 'pricing plans upgrade billing' },
    { label: 'Dashboard', href: '/dashboard', keywords: 'dashboard account alerts subscriptions' },
  ];

  let open = $state(false);
  let query = $state('');
  let selected = $state(0);
  let inputRef = $state(null);
  let listRef = $state(null);
  let triggerRef = $state(null);
  let isMac = $state(false);

  $effect(() => {
    isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  });

  /**
   * Subsequence match — every character of the needle must appear in order.
   * Scores exact prefix matches highest so typing "str" surfaces Stripe first.
   */
  function score(needle, haystack) {
    if (!needle) return 0;
    const h = haystack.toLowerCase();
    const n = needle.toLowerCase();
    if (h === n) return 1000;
    if (h.startsWith(n)) return 900 - h.length;
    const idx = h.indexOf(n);
    if (idx !== -1) return 700 - idx - h.length * 0.1;

    let hi = 0;
    for (const ch of n) {
      hi = h.indexOf(ch, hi);
      if (hi === -1) return -1;
      hi++;
    }
    return 400 - h.length * 0.1;
  }

  let results = $derived.by(() => {
    const items = [];

    for (const api of apis) {
      const best = Math.max(
        score(query, api.name),
        score(query, api.slug),
        score(query, categoryLabels[api.category] || api.category || ''),
      );
      if (best < 0) continue;
      items.push({
        kind: 'api',
        label: api.name,
        hint: categoryLabels[api.category] || api.category,
        status: api.current_status || 'operational',
        href: `/api/${api.slug}`,
        score: best,
      });
    }

    for (const p of pages) {
      const best = Math.max(score(query, p.label), score(query, p.keywords));
      if (best < 0) continue;
      items.push({ kind: 'page', label: p.label, hint: 'Page', href: p.href, score: best - 50 });
    }

    items.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    return items.slice(0, 40);
  });

  // Keep the highlight inside the result list as it shrinks while typing.
  $effect(() => {
    if (selected >= results.length) selected = Math.max(0, results.length - 1);
  });

  export function openPalette() {
    open = true;
    query = '';
    selected = 0;
  }

  function close() {
    open = false;
    triggerRef?.focus();
  }

  function choose(item) {
    if (!item) return;
    open = false;
    goto(item.href);
  }

  function scrollSelectedIntoView() {
    if (!listRef) return;
    const el = listRef.querySelector('[data-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }

  function onWindowKeydown(e) {
    const k = e.key?.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'k') {
      e.preventDefault();
      open ? close() : openPalette();
      return;
    }
    if (open) return;
    // Bare "/" opens search, but never while the user is typing somewhere else.
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const t = e.target;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      e.preventDefault();
      openPalette();
    }
  }

  function onPaletteKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = results.length ? (selected + 1) % results.length : 0;
      scrollSelectedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = results.length ? (selected - 1 + results.length) % results.length : 0;
      scrollSelectedIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[selected]);
    } else if (e.key === 'Tab') {
      // Only the input is focusable inside the dialog, so trap by staying put.
      e.preventDefault();
    }
  }

  $effect(() => {
    if (open) inputRef?.focus();
  });
</script>

<svelte:window onkeydown={onWindowKeydown} />

<button
  class="palette-trigger"
  bind:this={triggerRef}
  onclick={openPalette}
  aria-label="Open search — keyboard shortcut Control or Command K"
  aria-haspopup="dialog"
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
  </svg>
  <span class="trigger-label">Search</span>
  <kbd>{isMac ? '⌘' : 'Ctrl'}K</kbd>
</button>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="overlay" onclick={close} role="presentation"></div>

  <div
    class="palette"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="Search APIs and pages"
    onkeydown={onPaletteKeydown}
  >
    <div class="search-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        bind:this={inputRef}
        bind:value={query}
        type="text"
        placeholder="Search APIs, incidents, pages…"
        aria-label="Search APIs and pages"
        aria-controls="palette-results"
        aria-activedescendant={results.length ? `palette-opt-${selected}` : undefined}
        autocomplete="off"
        spellcheck="false"
      />
      <kbd class="esc">Esc</kbd>
    </div>

    <ul class="results" id="palette-results" role="listbox" aria-label="Search results" bind:this={listRef}>
      {#each results as item, i (item.kind + item.href)}
        <li role="none">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            id="palette-opt-{i}"
            role="option"
            tabindex="-1"
            aria-selected={i === selected}
            data-selected={i === selected}
            class="result"
            class:active={i === selected}
            onclick={() => choose(item)}
            onmouseenter={() => selected = i}
          >
            {#if item.kind === 'api'}
              <span class="dot" style="background: {statusColors[item.status] || statusColors.operational}"></span>
            {:else}
              <span class="page-icon" aria-hidden="true">→</span>
            {/if}
            <span class="result-label">{item.label}</span>
            <span class="result-hint">{item.hint}</span>
          </div>
        </li>
      {:else}
        <li class="empty" role="none">No matches for “{query}”</li>
      {/each}
    </ul>

    <div class="palette-footer">
      <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
      <span><kbd>↵</kbd> open</span>
      <span><kbd>Esc</kbd> close</span>
    </div>
  </div>
{/if}

<style>
  .palette-trigger {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-muted);
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .palette-trigger:hover {
    border-color: var(--color-primary);
    color: var(--color-text);
  }

  kbd {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    background: var(--color-surface-hover);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 0.05rem 0.3rem;
    color: var(--color-text-muted);
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(2px);
    z-index: 200;
  }

  .palette {
    position: fixed;
    top: 12vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, calc(100vw - 2rem));
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    z-index: 201;
    overflow: hidden;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-muted);
  }

  .search-row input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--color-text);
    font-size: 0.95rem;
    font-family: inherit;
  }

  .results {
    list-style: none;
    margin: 0;
    padding: 0.35rem;
    max-height: 52vh;
    overflow-y: auto;
  }

  .result {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.65rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .result.active {
    background: var(--color-surface-hover);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .page-icon {
    width: 8px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .result-label {
    color: var(--color-text);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-hint {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .empty {
    padding: 1.5rem 1rem;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .palette-footer {
    display: flex;
    gap: 1rem;
    padding: 0.55rem 1rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }

  .palette-footer span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  @media (max-width: 640px) {
    .trigger-label,
    .palette-trigger kbd {
      display: none;
    }

    .palette {
      top: 4vh;
    }
  }
</style>
