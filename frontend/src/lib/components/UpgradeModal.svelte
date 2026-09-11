<script>
  import { TIER_INFO, getNextTier } from '$lib/tier-limits.js';
  import Modal from '$lib/components/Modal.svelte';

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

{#if nextTier}
  <Modal bind:open={show} labelledBy="upgrade-modal-title" dialogClass="upgrade-modal">
      <h3 id="upgrade-modal-title">Upgrade to unlock more</h3>
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
  </Modal>
{/if}

<style>
  /* Backdrop, positioning and focus styling now come from Modal.svelte;
     this dialog just wants to be narrower than the default. */
  :global(.modal-dialog.upgrade-modal) {
    width: min(400px, calc(100vw - 2rem));
    padding: 2rem;
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
