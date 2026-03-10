<script>
  import SEO from '$lib/components/SEO.svelte';
</script>

<SEO
  title="Privacy Policy — APIdown.net"
  description="APIdown.net privacy policy. Learn how we collect, use, and protect your data."
  noindex={true}
/>

<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li aria-current="page">Privacy Policy</li>
  </ol>
</nav>

<article class="legal">
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: March 7, 2026</p>

  <section>
    <h2>1. Introduction</h2>
    <p>APIdown.net ("APIdown," "we," "us," or "our") is operated by Pearson Media LLC. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website at apidown.net and related services.</p>
  </section>

  <section>
    <h2>2. Information We Collect</h2>
    <h3>Account Information</h3>
    <p>When you create an account, we collect your email address, password (hashed), and optional profile information. If you sign in with GitHub, we receive your GitHub username and email.</p>

    <h3>API Signal Data</h3>
    <p>Our SDK collects anonymous HTTP request metadata (URL hostname, status code, response time, region) from your application. We do not collect request bodies, headers, authentication tokens, or any personally identifiable information from API calls.</p>

    <h3>Usage Data</h3>
    <p>We collect standard web analytics data including page views, browser type, and referring pages via Google Analytics. We use cookies for authentication sessions.</p>
  </section>

  <section>
    <h2>3. How We Use Your Information</h2>
    <ul>
      <li>To provide and maintain the APIdown service</li>
      <li>To send you alert notifications you have subscribed to</li>
      <li>To aggregate anonymous signal data for API health monitoring</li>
      <li>To process billing and subscriptions via Stripe</li>
      <li>To improve our service and user experience</li>
    </ul>
  </section>

  <section>
    <h2>4. Data Sharing</h2>
    <p>We do not sell your personal information. We share data only with:</p>
    <ul>
      <li><strong>Supabase</strong> — Database and authentication hosting</li>
      <li><strong>Stripe</strong> — Payment processing (Pro/Team subscriptions)</li>
      <li><strong>Cloudflare</strong> — Website hosting and CDN</li>
      <li><strong>Google Analytics</strong> — Anonymous usage analytics</li>
    </ul>
  </section>

  <section>
    <h2>5. Data Retention</h2>
    <p>Signal data is retained for 90 days, then automatically deleted. Account data is retained until you delete your account. Aggregated, anonymous statistics may be retained indefinitely.</p>
  </section>

  <section>
    <h2>6. Your Rights</h2>
    <p>You may request access to, correction of, or deletion of your personal data by contacting us. If you are in the EU/EEA, you have additional rights under GDPR including data portability and the right to object to processing.</p>
  </section>

  <section>
    <h2>7. Cookies</h2>
    <p>We use essential cookies for authentication (session tokens). We use Google Analytics cookies for anonymous usage tracking. You can disable non-essential cookies in your browser settings.</p>
  </section>

  <section>
    <h2>8. Security</h2>
    <p>We use industry-standard security measures including HTTPS encryption, hashed passwords, row-level security policies, and API key hashing. However, no method of transmission over the Internet is 100% secure.</p>
  </section>

  <section>
    <h2>9. Children's Privacy</h2>
    <p>APIdown is not intended for children under 13. We do not knowingly collect information from children under 13.</p>
  </section>

  <section>
    <h2>10. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify registered users of material changes via email.</p>
  </section>

  <section>
    <h2>11. Contact Us</h2>
    <p>For privacy-related inquiries, contact us at <a href="mailto:privacy@apidown.net">privacy@apidown.net</a> or through our <a href="/docs">documentation page</a>.</p>
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

  h3 {
    font-size: 0.95rem;
    margin: 1rem 0 0.4rem;
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
