<svelte:head>
  <title>Terms of Service — APIdown.net</title>
  <meta name="description" content="APIdown.net terms of service. Read our terms and conditions for using the platform." />
  <meta name="robots" content="noindex" />
</svelte:head>

<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li aria-current="page">Terms of Service</li>
  </ol>
</nav>

<article class="legal">
  <h1>Terms of Service</h1>
  <p class="updated">Last updated: March 7, 2026</p>

  <section>
    <h2>1. Agreement to Terms</h2>
    <p>By accessing or using APIdown.net ("the Service"), operated by Pearson Media LLC, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
  </section>

  <section>
    <h2>2. Description of Service</h2>
    <p>APIdown provides crowd-sourced, real-time API health monitoring. The Service aggregates anonymous signal data from production traffic to detect and report API outages and performance degradation.</p>
  </section>

  <section>
    <h2>3. User Accounts</h2>
    <ul>
      <li>You must provide accurate and complete registration information</li>
      <li>You are responsible for maintaining the security of your account credentials</li>
      <li>You must notify us immediately of any unauthorized account access</li>
      <li>You must be at least 13 years old to create an account</li>
    </ul>
  </section>

  <section>
    <h2>4. Acceptable Use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Submit false or misleading signal data or incident reports</li>
      <li>Attempt to access other users' data or accounts</li>
      <li>Use the Service to conduct denial-of-service attacks or abuse API endpoints</li>
      <li>Reverse engineer, decompile, or disassemble the Service</li>
      <li>Resell or redistribute the Service without permission</li>
      <li>Use automated systems to scrape data beyond what is provided via our API</li>
    </ul>
  </section>

  <section>
    <h2>5. API Keys and SDK Usage</h2>
    <p>API keys are issued for your use only and must not be shared publicly. You are responsible for all activity under your API keys. We reserve the right to revoke keys that violate our acceptable use policy or exceed rate limits.</p>
  </section>

  <section>
    <h2>6. Subscription Plans and Billing</h2>
    <ul>
      <li><strong>Free tier</strong> — Available indefinitely with feature limitations</li>
      <li><strong>Pro and Team tiers</strong> — Billed monthly or annually via Stripe</li>
      <li>You may cancel your subscription at any time; access continues until the end of the billing period</li>
      <li>Refunds are handled on a case-by-case basis</li>
      <li>We reserve the right to change pricing with 30 days advance notice</li>
    </ul>
  </section>

  <section>
    <h2>7. Data and Privacy</h2>
    <p>Your use of the Service is also governed by our <a href="/privacy">Privacy Policy</a>. By using the Service, you consent to the collection and use of data as described therein.</p>
  </section>

  <section>
    <h2>8. Disclaimer of Warranties</h2>
    <p>The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that API status information is accurate, complete, or timely. APIdown is a monitoring tool, not a guarantee of third-party API availability.</p>
  </section>

  <section>
    <h2>9. Limitation of Liability</h2>
    <p>To the maximum extent permitted by law, Pearson Media LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to loss of revenue, data, or business opportunities.</p>
  </section>

  <section>
    <h2>10. Intellectual Property</h2>
    <p>The APIdown name, logo, and website content are the property of Pearson Media LLC. The open-source SDK components are licensed under their respective licenses as specified in the repository.</p>
  </section>

  <section>
    <h2>11. Termination</h2>
    <p>We may suspend or terminate your account at any time for violation of these Terms. You may delete your account at any time. Upon termination, your data will be deleted in accordance with our Privacy Policy.</p>
  </section>

  <section>
    <h2>12. Changes to Terms</h2>
    <p>We may modify these Terms at any time. Material changes will be communicated via email to registered users at least 30 days in advance. Continued use of the Service after changes constitutes acceptance.</p>
  </section>

  <section>
    <h2>13. Governing Law</h2>
    <p>These Terms are governed by the laws of the United States. Any disputes shall be resolved in the courts of the state where Pearson Media LLC is incorporated.</p>
  </section>

  <section>
    <h2>14. Contact</h2>
    <p>For questions about these Terms, contact us at <a href="mailto:legal@apidown.net">legal@apidown.net</a>.</p>
  </section>
</article>

<style>
  .legal {
    max-width: 720px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .updated {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    margin-bottom: 2rem;
  }

  section {
    margin-bottom: 2rem;
  }

  h2 {
    font-size: 1.1rem;
    margin-bottom: 0.75rem;
    color: var(--color-text);
  }

  p {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    line-height: 1.7;
    margin-bottom: 0.75rem;
  }

  ul {
    padding-left: 1.5rem;
    margin-bottom: 0.75rem;
  }

  li {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    line-height: 1.7;
    margin-bottom: 0.3rem;
  }

  .breadcrumb { margin-bottom: 1.5rem; }
  .breadcrumb ol { list-style: none; padding: 0; margin: 0; display: flex; gap: 0.35rem; font-size: 0.8rem; color: var(--color-text-muted); }
  .breadcrumb li { margin-bottom: 0; }
  .breadcrumb li:not(:last-child)::after { content: '\203A'; margin-left: 0.35rem; }
  .breadcrumb a { color: var(--color-text-muted); text-decoration: none; }
  .breadcrumb a:hover { color: var(--color-primary); }
</style>
