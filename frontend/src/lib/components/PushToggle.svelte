<script>
  /**
   * Opt in to browser notifications for a set of APIs. Used on the API detail
   * page (a single API) and on /stack (the whole watchlist).
   */
  import { loadPushState, subscribeToPush, unsubscribeFromPush } from '$lib/push.js';

  let { slugs = [], label = 'this API', compact = false } = $props();

  let state = $state(null);
  let busy = $state(false);
  let message = $state('');
  let messageError = $state(false);

  // Loading push state touches the service worker registration, so it only runs
  // in the browser, after hydration.
  $effect(() => {
    let cancelled = false;
    loadPushState()
      .then(s => { if (!cancelled) state = s; })
      .catch(() => { if (!cancelled) state = { supported: false, reason: 'Could not check notification support.' }; });
    return () => { cancelled = true; };
  });

  let watchingAll = $derived(
    !!state?.watching?.length && slugs.length > 0 && slugs.every(s => state.watching.includes(s)),
  );

  async function enable() {
    busy = true;
    message = '';
    try {
      // Merge rather than replace: a browser may already watch other APIs.
      const merged = [...new Set([...(state.watching || []), ...slugs])];
      const result = await subscribeToPush(merged, {
        vapidKey: state.vapidKey,
        minSeverity: state.minSeverity,
      });
      state = { ...state, permission: 'granted', watching: result.watching };
      message = `You'll get a notification when ${label} goes down.`;
      messageError = false;
    } catch (err) {
      message = err.message;
      messageError = true;
    }
    busy = false;
  }

  async function disable() {
    busy = true;
    message = '';
    try {
      const remaining = (state.watching || []).filter(s => !slugs.includes(s));
      if (remaining.length > 0) {
        // Keep the browser subscribed for the APIs it still watches.
        const result = await subscribeToPush(remaining, {
          vapidKey: state.vapidKey,
          minSeverity: state.minSeverity,
        });
        state = { ...state, watching: result.watching };
      } else {
        await unsubscribeFromPush();
        state = { ...state, watching: [] };
      }
      message = 'Notifications turned off.';
      messageError = false;
    } catch (err) {
      message = err.message;
      messageError = true;
    }
    busy = false;
  }
</script>

{#if state}
  <div class="push" class:compact>
    {#if !state.supported}
      <p class="unavailable">{state.reason} You can still <a href="#subscribe">get email alerts</a>.</p>
    {:else if !state.configured}
      <p class="unavailable">
        Browser notifications aren't enabled on this deployment yet.
        <a href="#subscribe">Email alerts</a> work today.
      </p>
    {:else if state.permission === 'denied'}
      <p class="unavailable">
        Notifications are blocked for this site in your browser settings. Unblock them there, or
        <a href="#subscribe">use email alerts</a> instead.
      </p>
    {:else if slugs.length === 0}
      <p class="unavailable">Add an API to your stack first, then turn on notifications.</p>
    {:else if watchingAll}
      <button class="btn-off" onclick={disable} disabled={busy}>
        {busy ? 'Updating…' : 'Turn off notifications'}
      </button>
      <span class="hint">Notifying this browser about {label}.</span>
    {:else}
      <button class="btn-on" onclick={enable} disabled={busy}>
        {busy ? 'Enabling…' : 'Notify me if it goes down'}
      </button>
      <span class="hint">Browser notifications. No account, no email address.</span>
    {/if}

    {#if message}
      <p class="msg" class:msg-error={messageError} aria-live="polite">{message}</p>
    {/if}
  </div>
{/if}

<style>
  .push {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .compact { font-size: 0.85rem; }

  button {
    border: none;
    border-radius: 6px;
    padding: 0.45rem 0.95rem;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-on {
    background: var(--color-primary);
    color: #fff;
  }

  .btn-off {
    background: none;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
  }

  button:hover:not(:disabled) { opacity: 0.9; }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .hint, .unavailable {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .unavailable { max-width: 460px; }

  .msg {
    width: 100%;
    font-size: 0.8rem;
    color: var(--color-operational);
  }

  .msg-error { color: var(--color-down); }
</style>
