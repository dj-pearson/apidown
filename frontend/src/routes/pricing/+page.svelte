<script>
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        '1 API key',
        '5 alert subscriptions',
        'Email alerts only',
        'Immediate alerts',
        'Community support',
      ],
      cta: 'Get Started',
      href: '/login',
      highlighted: false,
    },
    {
      name: 'Pro',
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
      cta: 'Upgrade to Pro',
      href: '/login',
      highlighted: true,
    },
    {
      name: 'Team',
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
      cta: 'Upgrade to Team',
      href: '/login',
      highlighted: false,
    },
  ];
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
        <a href={plan.href} class="cta" class:cta-primary={plan.highlighted}>{plan.cta}</a>
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
</style>
