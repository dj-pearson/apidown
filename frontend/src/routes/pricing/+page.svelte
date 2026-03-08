<script>
  let { data } = $props();
  let loading = $state(null);
  let billingPeriod = $state('monthly');

  const plans = [
    {
      name: 'Free',
      tier: 'free',
      monthlyPrice: 0,
      annualPrice: 0,
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
      monthlyPrice: 19,
      annualPrice: 15,
      period: '/month',
      features: [
        '10 API keys',
        '50 alert subscriptions',
        'All alert channels',
        'Immediate + digest alerts',
        'SLA export reports',
        '1 public status page',
        'Priority support',
      ],
      highlighted: true,
    },
    {
      name: 'Team',
      tier: 'team',
      monthlyPrice: 49,
      annualPrice: 39,
      period: '/month',
      features: [
        'Unlimited API keys',
        'Unlimited alert subscriptions',
        'All alert channels',
        'Immediate + digest alerts',
        'SLA export reports',
        '3 public status pages',
        'White-label status pages',
        'Team management',
        'Dedicated support',
      ],
      highlighted: false,
    },
  ];

  function getPrice(plan) {
    if (plan.tier === 'free') return '$0';
    return billingPeriod === 'annual' ? `$${plan.annualPrice}` : `$${plan.monthlyPrice}`;
  }

  function getPeriod(plan) {
    if (plan.tier === 'free') return 'forever';
    return billingPeriod === 'annual' ? '/mo billed annually' : '/month';
  }

  const comparisonFeatures = [
    { name: 'API keys', free: '1', pro: '10', team: 'Unlimited' },
    { name: 'Alert subscriptions', free: '5', pro: '50', team: 'Unlimited' },
    { name: 'Email alerts', free: true, pro: true, team: true },
    { name: 'Slack alerts', free: false, pro: true, team: true },
    { name: 'Discord alerts', free: false, pro: true, team: true },
    { name: 'PagerDuty alerts', free: false, pro: true, team: true },
    { name: 'Microsoft Teams alerts', free: false, pro: true, team: true },
    { name: 'Webhook alerts', free: false, pro: true, team: true },
    { name: 'Digest alerts', free: false, pro: true, team: true },
    { name: 'SLA export reports', free: false, pro: true, team: true },
    { name: 'Custom API monitoring', free: false, pro: true, team: true },
    { name: 'Public status pages', free: '—', pro: '1', team: '3' },
    { name: 'Status page uptime bars', free: false, pro: true, team: true },
    { name: 'Status page latency charts', free: false, pro: true, team: true },
    { name: 'Status page subscribers', free: false, pro: true, team: true },
    { name: 'White-label status pages', free: false, pro: false, team: true },
    { name: 'My App stats', free: false, pro: true, team: true },
    { name: 'Extended latency history', free: false, pro: true, team: true },
    { name: 'Team management', free: false, pro: false, team: true },
    { name: 'Support', free: 'Community', pro: 'Priority', team: 'Dedicated' },
  ];

  const testimonials = [
    {
      quote: "APIdown caught a Stripe degradation 12 minutes before their status page updated. That's the kind of heads-up that saves revenue.",
      name: 'Sarah Chen',
      role: 'Staff Engineer',
      company: 'FinFlow',
    },
    {
      quote: "We replaced three monitoring tools with APIdown's SDK. One line of code and we get real latency data from actual production traffic.",
      name: 'Marcus Rodriguez',
      role: 'Platform Lead',
      company: 'Stackwise',
    },
    {
      quote: "The crowd-sourced approach means we know if an API issue is global or just us. That alone is worth the Pro plan.",
      name: 'Priya Patel',
      role: 'SRE Manager',
      company: 'DataPulse',
    },
  ];

  const tierRank = { free: 0, pro: 1, team: 2 };

  function getCta(plan) {
    if (!data.user) return { label: plan.tier === 'free' ? 'Get Started' : `Upgrade to ${plan.name}`, action: 'login' };
    const currentTier = data.tier || 'free';
    if (plan.tier === currentTier) return { label: 'Current Plan', action: 'none' };
    // Free → paid: go through Stripe Checkout
    if (currentTier === 'free' && plan.tier !== 'free') return { label: `Upgrade to ${plan.name}`, action: 'checkout' };
    // Paid → different paid (upgrade or downgrade): use Billing Portal so user sees proration
    if (currentTier !== 'free' && plan.tier !== 'free') return { label: `Switch to ${plan.name}`, action: 'portal' };
    // Paid → free: billing portal to cancel
    return { label: 'Manage Billing', action: 'portal' };
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
      } else if (result.upgraded) {
        // Inline upgrade (existing subscription updated) — go to dashboard
        window.location.href = '/dashboard';
      } else {
        alert(result.error || 'Failed to start checkout');
        loading = null;
      }
    } catch {
      alert('Something went wrong. Please try again.');
      loading = null;
    }
  }

  async function openBillingPortal() {
    loading = 'portal';
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        alert(result.error || 'Could not open billing portal.');
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
  <meta name="description" content="Simple, transparent pricing for API health monitoring. Free forever for individual developers. Pro $19/mo, Team $49/mo." />
  {@html `<script type="application/ld+json">${JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "APIdown.net Pricing",
      "description": "Simple, transparent pricing for real-time API health monitoring",
      "url": "https://apidown.net/pricing",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://apidown.net" },
          { "@type": "ListItem", "position": 2, "name": "Pricing", "item": "https://apidown.net/pricing" }
        ]
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "APIdown.net",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Web",
      "offers": [
        { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD", "description": "1 API key, 5 alert subscriptions, email alerts, community support" },
        { "@type": "Offer", "name": "Pro", "price": "19", "priceCurrency": "USD", "billingIncrement": "P1M", "description": "10 API keys, 50 alert subscriptions, all alert channels, SLA export reports, priority support" },
        { "@type": "Offer", "name": "Team", "price": "49", "priceCurrency": "USD", "billingIncrement": "P1M", "description": "Unlimited API keys, unlimited alert subscriptions, all alert channels, team management, dedicated support" }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Can I downgrade my plan?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. You can downgrade at any time from your dashboard. Your current plan benefits will remain active until the end of your billing period, then you'll switch to the lower tier." } },
        { "@type": "Question", "name": "What payment methods do you accept?", "acceptedAnswer": { "@type": "Answer", "text": "We accept all major credit and debit cards (Visa, Mastercard, American Express) via Stripe. We also support bank transfers for annual Team plans." } },
        { "@type": "Question", "name": "Is there a free trial for paid plans?", "acceptedAnswer": { "@type": "Answer", "text": "We don't offer a traditional free trial, but our Free tier is fully functional and never expires. You can monitor APIs, receive email alerts, and evaluate the platform before upgrading." } },
        { "@type": "Question", "name": "What happens when I exceed my plan limits?", "acceptedAnswer": { "@type": "Answer", "text": "You won't lose any data. If you exceed your API key or subscription limits, you'll be prompted to upgrade or remove existing keys/subscriptions before creating new ones. Existing monitoring continues uninterrupted." } },
        { "@type": "Question", "name": "Can I get a refund?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. If you're not satisfied within the first 14 days of a paid plan, contact us for a full refund. After 14 days, you can cancel anytime and your plan will remain active until the end of the billing period." } }
      ]
    }
  ])}</script>`}
</svelte:head>

<div class="pricing-page">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li aria-current="page">Pricing</li>
    </ol>
  </nav>

  <h1>Simple, Transparent Pricing</h1>
  <p class="subtitle">Free forever for individual developers. Upgrade for more power.</p>

  <div class="billing-toggle">
    <button class:active={billingPeriod === 'monthly'} onclick={() => billingPeriod = 'monthly'}>Monthly</button>
    <button class:active={billingPeriod === 'annual'} onclick={() => billingPeriod = 'annual'}>
      Annual <span class="save-badge">Save 20%</span>
    </button>
  </div>

  <div class="plans">
    {#each plans as plan}
      {@const cta = getCta(plan)}
      <div class="plan-card" class:highlighted={plan.highlighted}>
        {#if plan.highlighted}
          <span class="popular">Most Popular</span>
        {/if}
        <h2>{plan.name}</h2>
        <div class="price">
          <span class="amount">{getPrice(plan)}</span>
          <span class="period">{getPeriod(plan)}</span>
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
        {:else if cta.action === 'portal'}
          <button class="cta" disabled={loading === 'portal'} onclick={openBillingPortal}>
            {loading === 'portal' ? 'Redirecting…' : cta.label}
          </button>
        {:else}
          <span class="cta cta-current">{cta.label}</span>
        {/if}
      </div>
    {/each}
  </div>

  <section class="faq">
    <h2>Frequently Asked Questions</h2>
    <div class="faq-list">
      <details>
        <summary>Can I downgrade my plan?</summary>
        <p>Yes. You can downgrade at any time from your dashboard. Your current plan benefits will remain active until the end of your billing period, then you'll switch to the lower tier.</p>
      </details>
      <details>
        <summary>What payment methods do you accept?</summary>
        <p>We accept all major credit and debit cards (Visa, Mastercard, American Express) via Stripe. We also support bank transfers for annual Team plans.</p>
      </details>
      <details>
        <summary>Is there a free trial for paid plans?</summary>
        <p>We don't offer a traditional free trial, but our Free tier is fully functional and never expires. You can monitor APIs, receive email alerts, and evaluate the platform before upgrading.</p>
      </details>
      <details>
        <summary>What happens when I exceed my plan limits?</summary>
        <p>You won't lose any data. If you exceed your API key or subscription limits, you'll be prompted to upgrade or remove existing keys/subscriptions before creating new ones. Existing monitoring continues uninterrupted.</p>
      </details>
      <details>
        <summary>Can I get a refund?</summary>
        <p>Yes. If you're not satisfied within the first 14 days of a paid plan, contact us for a full refund. After 14 days, you can cancel anytime and your plan will remain active until the end of the billing period.</p>
      </details>
    </div>
  </section>

  <!-- Feature Comparison Table -->
  <section class="comparison" aria-label="Feature comparison">
    <h2>Feature Comparison</h2>
    <div class="comparison-wrapper">
      <table>
        <thead>
          <tr>
            <th class="feature-col">Feature</th>
            <th>Free</th>
            <th class="highlighted-col">Pro</th>
            <th>Team</th>
          </tr>
        </thead>
        <tbody>
          {#each comparisonFeatures as feat}
            <tr>
              <td class="feature-col">{feat.name}</td>
              {#each ['free', 'pro', 'team'] as tier}
                <td class:highlighted-col={tier === 'pro'}>
                  {#if feat[tier] === true}
                    <span class="check">&#10003;</span>
                  {:else if feat[tier] === false}
                    <span class="cross">&#10007;</span>
                  {:else}
                    {feat[tier]}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Testimonials -->
  <section class="testimonials" aria-label="Customer testimonials">
    <h2>Trusted by Developers</h2>
    <div class="testimonials-grid">
      {#each testimonials as t}
        <div class="testimonial-card">
          <blockquote>"{t.quote}"</blockquote>
          <div class="testimonial-author">
            <div class="author-avatar">{t.name[0]}</div>
            <div>
              <strong>{t.name}</strong>
              <span>{t.role}, {t.company}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .pricing-page {
    text-align: center;
  }

  .breadcrumb { margin-bottom: 1rem; text-align: left; }
  .breadcrumb ol { list-style: none; padding: 0; margin: 0; display: flex; gap: 0.35rem; font-size: 0.8rem; color: var(--color-text-muted); }
  .breadcrumb li:not(:last-child)::after { content: '\203A'; margin-left: 0.35rem; }
  .breadcrumb a { color: var(--color-text-muted); text-decoration: none; }
  .breadcrumb a:hover { color: var(--color-primary); }

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

  .faq {
    max-width: 700px;
    margin: 3rem auto 0;
    text-align: left;
  }

  .faq h2 {
    font-size: 1.25rem;
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  details {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
  }

  details[open] {
    border-color: var(--color-primary);
  }

  summary {
    padding: 0.85rem 1rem;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::after {
    content: '+';
    font-size: 1.1rem;
    color: var(--color-text-muted);
    flex-shrink: 0;
    margin-left: 1rem;
  }

  details[open] summary::after {
    content: '−';
  }

  details p {
    padding: 0 1rem 0.85rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.6;
  }

  /* Billing toggle */
  .billing-toggle {
    display: flex;
    justify-content: center;
    gap: 0;
    margin-bottom: 2rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.25rem;
    width: fit-content;
    margin-left: auto;
    margin-right: auto;
  }

  .billing-toggle button {
    background: none;
    border: none;
    padding: 0.5rem 1.25rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .billing-toggle button.active {
    background: var(--color-primary);
    color: #fff;
  }

  .save-badge {
    font-size: 0.65rem;
    background: var(--color-operational);
    color: #000;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 700;
    text-transform: uppercase;
  }

  /* Comparison table */
  .comparison {
    max-width: 800px;
    margin: 3rem auto 0;
    text-align: left;
  }

  .comparison h2 {
    font-size: 1.25rem;
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .comparison-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  thead th {
    padding: 0.75rem 1rem;
    font-weight: 600;
    font-size: 0.85rem;
    border-bottom: 2px solid var(--color-border);
    text-align: center;
    color: var(--color-text);
  }

  thead th.feature-col {
    text-align: left;
  }

  .highlighted-col {
    background: rgba(6, 182, 212, 0.05);
  }

  thead th.highlighted-col {
    color: var(--color-primary);
  }

  tbody td {
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--color-border);
    text-align: center;
    color: var(--color-text-muted);
  }

  tbody td.feature-col {
    text-align: left;
    color: var(--color-text);
    font-weight: 500;
    white-space: nowrap;
    position: sticky;
    left: 0;
    background: var(--color-bg);
  }

  .check {
    color: var(--color-operational);
    font-weight: 700;
  }

  .cross {
    color: var(--color-text-muted);
    opacity: 0.4;
  }

  /* Testimonials */
  .testimonials {
    max-width: 900px;
    margin: 3rem auto 0;
  }

  .testimonials h2 {
    font-size: 1.25rem;
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .testimonials-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.25rem;
  }

  .testimonial-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .testimonial-card blockquote {
    font-size: 0.85rem;
    color: var(--color-text);
    line-height: 1.6;
    margin: 0;
    font-style: italic;
  }

  .testimonial-author {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .author-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--color-primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .testimonial-author strong {
    display: block;
    font-size: 0.85rem;
    color: var(--color-text);
  }

  .testimonial-author span {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>
