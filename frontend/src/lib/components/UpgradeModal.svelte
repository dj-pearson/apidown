<script>
  import { TIER_INFO, getNextTier } from '$lib/tier-limits.js';

  let { show = $bindable(false), currentTier, limitType, currentUsage, maxUsage } = $props();

  const nextTierKey = $derived(getNextTier(currentTier));
  const nextTier = $derived(nextTierKey ? TIER_INFO[nextTierKey] : null);

  const limitLabel = $derived(
    limitType === 'apiKeys' ? 'API keys'
    : limitType === 'customApis' ? 'custom APIs'
    : 'alert subscriptions'
  );

  function close() {
    show = false;
  }
</script>

{#if show && nextTier}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h3>Upgrade to unlock more</h3>
      <p class="limit-msg">
        You've used all <strong>{currentUsage}/{maxUsage}</strong> {limitLabel} on the <strong>{currentTier}</strong> plan.
      </p>

      <div class="next-tier">
        <span class="tier-name">{nextTier.name}</span>
        <span class="tier-price">{nextTier.price}</span>
      </div>
      <ul class="features">
        <li>{nextTier.apiKeys === 'Unlimited' ? 'Unlimited' : nextTier.apiKeys} API keys</li>
        <li>{nextTier.customApis === 'Unlimited' ? 'Unlimited' : nextTier.customApis} custom APIs</li>
        <li>{nextTier.subscriptions === 'Unlimited' ? 'Unlimited' : nextTier.subscriptions} alert subscriptions</li>
        <li>All notification channels</li>
      </ul>

      <div class="actions">
        <a href="/pricing" class="btn-upgrade">Upgrade to {nextTier.name}</a>
        <button class="btn-dismiss" onclick={close}>Not now</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--color-surface, #1a1a2e);
    border: 1px solid var(--color-border, #333);
    border-radius: 12px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
  }

  h3 {
    margin: 0 0 0.75rem;
    font-size: 1.15rem;
  }

  .limit-msg {
    color: var(--color-text-muted, #999);
    font-size: 0.9rem;
    margin-bottom: 1.25rem;
  }

  .next-tier {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-bg, #111);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .tier-name {
    font-weight: 700;
    font-size: 1rem;
  }

  .tier-price {
    color: var(--color-primary, #6c63ff);
    font-weight: 600;
    font-size: 0.95rem;
  }

  .features {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem;
  }

  .features li {
    padding: 0.3rem 0;
    font-size: 0.85rem;
    color: var(--color-text-muted, #999);
  }

  .features li::before {
    content: '\2713 ';
    color: var(--color-operational, #4ade80);
    margin-right: 0.4rem;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn-upgrade {
    flex: 1;
    text-align: center;
    background: var(--color-primary, #6c63ff);
    color: #fff;
    border: none;
    padding: 0.6rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .btn-upgrade:hover { opacity: 0.9; }

  .btn-dismiss {
    background: none;
    color: var(--color-text-muted, #999);
    border: 1px solid var(--color-border, #333);
    padding: 0.6rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .btn-dismiss:hover { border-color: var(--color-text-muted, #999); }
</style>
