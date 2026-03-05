<script>
  let { data } = $props();
  let loading = $state(null);

  const plans = [
    {
      name: 'Free',
      tier: 'free',
      price: '$0',
      period: 'forever',
      features: [
        '1 API key',
        '5 alert subscriptions',
        'Email alerts only',
        'Immediate alerts',
        'Community support',
      ],
      highlighted: false,
    },
    {
      name: 'Pro',
      tier: 'pro',
      price: '$19',
      period: '/month',
      features: [
        '10 API keys',
        '50 alert subscriptions',
        'All alert channels',
        'Immediate + digest alerts',
        'SLA export reports',
        'Priority support',
      ],
      highlighted: true,
    },
    {
      name: 'Team',
      tier: 'team',
      price: '$49',
      period: '/month',
      features: [
        'Unlimited API keys',
        'Unlimited alert subscriptions',
        'All alert channels',
        'Immediate + digest alerts',
        'SLA export reports',
        'Team management',
        'Dedicated support',
      ],
      highlighted: false,
    },
  ];

  function getCta(plan) {
    if (!data.user) return { label: plan.tier === 'free' ? 'Get Started' : `Upgrade to ${plan.name}`, action: 'login' };
    if (plan.tier === 'free') return { label: 'Current Plan', action: 'none' };
    return { label: `Upgrade to ${plan.name}`, action: 'checkout' };
  }

  async function startCheckout(tier) {
    loading = tier;
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        alert(result.message || 'Failed to start checkout');
        loading = null;
      }
    } catch {
      alert('Something went wrong. Please try again.');
      loading = null;
    }
  }
</script>

<svelte:head>
  <title>Pricing — APIdown.net</title>
  <meta name="description" content="Simple, transparent pricing for API health monitoring. Free forever for individual developers." />
</svelte:head>

<div class="pricing-page">
  <h1>Simple, Transparent Pricing</h1>
  <p class="subtitle">Free forever for individual developers. Upgrade for more power.</p>

  <div class="plans">
    {#each plans as plan}
      {@const cta = getCta(plan)}
      <div class="plan-card" class:highlighted={plan.highlighted}>
        {#if plan.highlighted}
          <span class="popular">Most Popular</span>
        {/if}
        <h2>{plan.name}</h2>
        <div class="price">
          <span class="amount">{plan.price}</span>
          <span class="period">{plan.period}</span>
        </div>
        <ul>
          {#each plan.features as feature}
            <li>{feature}</li>
          {/each}
        </ul>
        {#if cta.action === 'login'}
          <a href="/login" class="cta" class:cta-primary={plan.highlighted}>{cta.label}</a>
        {:else if cta.action === 'checkout'}
          <button class="cta" class:cta-primary={plan.highlighted} disabled={loading === plan.tier} onclick={() => startCheckout(plan.tier)}>
            {loading === plan.tier ? 'Redirecting…' : cta.label}
          </button>
        {:else}
          <span class="cta cta-current">{cta.label}</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .pricing-page {
    text-align: center;
  }

  h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
  .subtitle { color: var(--color-text-muted); margin-bottom: 2.5rem; }

  .plans {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .plan-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 2rem 1.5rem;
    text-align: left;
    position: relative;
  }

  .plan-card.highlighted {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .popular {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-primary);
    color: #fff;
    padding: 0.15rem 0.75rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }

  .price {
    margin-bottom: 1.5rem;
  }

  .amount { font-size: 2.5rem; font-weight: 700; }
  .period { font-size: 0.9rem; color: var(--color-text-muted); }

  ul {
    list-style: none;
    padding: 0;
    margin-bottom: 1.5rem;
  }

  li {
    padding: 0.4rem 0;
    font-size: 0.85rem;
    color: var(--color-text);
    border-bottom: 1px solid var(--color-border);
  }

  li::before {
    content: '\2713 ';
    color: var(--color-operational);
    font-weight: 700;
    margin-right: 0.4rem;
  }

  .cta {
    display: block;
    text-align: center;
    padding: 0.6rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    text-decoration: none;
    border: 1px solid var(--color-border);
    color: var(--color-text);
    transition: background 0.15s;
  }

  .cta:hover { background: var(--color-surface-hover); text-decoration: none; }

  .cta-primary {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }

  .cta-primary:hover { opacity: 0.9; background: var(--color-primary); }

  button.cta {
    cursor: pointer;
    font-family: inherit;
  }

  button.cta:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cta-current {
    opacity: 0.5;
    cursor: default;
  }
</style>
