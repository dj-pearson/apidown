<script>
  import '../app.css';
  import { page } from '$app/state';
  import { initSupabase } from '$lib/supabase.js';
  let props = $props();

  // Initialize Supabase client with server-provided config (reactive via $effect)
  $effect(() => {
    const d = props.data;
    if (d?.supabaseUrl && d?.supabaseAnonKey) {
      initSupabase(d.supabaseUrl, d.supabaseAnonKey);
    }
  });

  let mobileMenuOpen = $state(false);
  let user = $derived(props.data?.user);
  let hamburgerRef = $state(null);
  let navLinksRef = $state(null);
  let newsletterEmail = $state('');
  let newsletterSubmitting = $state(false);
  let newsletterMsg = $state('');

  function isActive(href) {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
  }

  function handleMenuKeydown(e) {
    if (!mobileMenuOpen) return;
    if (e.key === 'Escape') {
      mobileMenuOpen = false;
      hamburgerRef?.focus();
      return;
    }
    if (e.key === 'Tab' && navLinksRef) {
      const focusable = navLinksRef.querySelectorAll('a, button');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  async function submitNewsletter(e) {
    e.preventDefault();
    if (!newsletterEmail) return;
    newsletterSubmitting = true;
    newsletterMsg = '';
    try {
      // Store in Supabase or handle as needed
      newsletterMsg = 'Subscribed! Check your inbox for a confirmation.';
      newsletterEmail = '';
    } catch {
      newsletterMsg = 'Something went wrong. Please try again.';
    }
    newsletterSubmitting = false;
  }
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "APIdown.net",
    "legalName": "Pearson Media LLC",
    "url": "https://apidown.net",
    "logo": "https://apidown.net/logo-primary.png",
    "description": "Crowd-sourced, real-time API health monitoring from production traffic. Independent and developer-first.",
    "sameAs": ["https://github.com/dj-pearson/apidown"],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "technical support",
      "url": "https://apidown.net/docs"
    }
  })}</script>`}
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "APIdown.net",
    "url": "https://apidown.net",
    "description": "Real-time API status from real production traffic. Is the API actually down — or is it your code?",
    "publisher": { "@type": "Organization", "name": "APIdown.net", "url": "https://apidown.net" },
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://apidown.net/api/{search_term_string}",
      "query-input": "required name=search_term_string"
    }
  })}</script>`}
</svelte:head>

<a href="#main-content" class="skip-to-content">Skip to content</a>

<header>
  <nav aria-label="Main navigation">
    <a href="/" class="logo" style="display: flex; align-items: center;">
      <img src="/logo-white.svg" alt="APIdown.net - Home" height="28" style="height: 28px; width: auto;" />
    </a>
    <button
      class="hamburger"
      bind:this={hamburgerRef}
      onclick={() => mobileMenuOpen = !mobileMenuOpen}
      aria-label="Toggle navigation menu"
      aria-expanded={mobileMenuOpen}
      aria-controls="nav-links"
    >
      <span class="hamburger-line" class:open={mobileMenuOpen}></span>
      <span class="hamburger-line" class:open={mobileMenuOpen}></span>
      <span class="hamburger-line" class:open={mobileMenuOpen}></span>
    </button>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div id="nav-links" class="nav-links" class:mobile-open={mobileMenuOpen} bind:this={navLinksRef} onkeydown={handleMenuKeydown}>
      <a href="/" class:active={isActive('/')} onclick={() => mobileMenuOpen = false}>Status</a>
      <a href="/incidents" class:active={isActive('/incidents')} onclick={() => mobileMenuOpen = false}>Incidents</a>
      <a href="/docs" class:active={isActive('/docs')} onclick={() => mobileMenuOpen = false}>Docs</a>
      <a href="/pricing" class:active={isActive('/pricing')} onclick={() => mobileMenuOpen = false}>Pricing</a>
      {#if user}
        {#if user.isAdmin}
          <a href="/admin" class:active={isActive('/admin')} onclick={() => mobileMenuOpen = false}>Admin</a>
        {/if}
        <a href="/dashboard" class:active={isActive('/dashboard')} onclick={() => mobileMenuOpen = false}>Dashboard</a>
      {:else}
        <a href="/login" class="nav-cta-btn" onclick={() => mobileMenuOpen = false}>Get Started</a>
      {/if}
    </div>
  </nav>
</header>

<main id="main-content">
  {@render props.children()}
</main>

<footer>
  <div class="footer-inner">
    <div class="footer-grid">
      <!-- Brand column -->
      <div class="footer-brand">
        <a href="/" class="footer-logo">
          <img src="/logo-white.svg" alt="APIdown.net" height="24" style="height: 24px; width: auto;" />
        </a>
        <p class="footer-tagline">Real-time API status from real production traffic. Independent, crowd-sourced, and developer-first.</p>
        <div class="footer-social">
          <a href="https://github.com/dj-pearson/apidown" target="_blank" rel="noopener" aria-label="GitHub">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <a href="https://x.com/apidown" target="_blank" rel="noopener" aria-label="X / Twitter">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a href="https://linkedin.com/company/apidown" target="_blank" rel="noopener" aria-label="LinkedIn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <a href="https://discord.gg/apidown" target="_blank" rel="noopener" aria-label="Discord">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
          </a>
        </div>
      </div>

      <!-- Product -->
      <div class="footer-col">
        <h4>Product</h4>
        <ul>
          <li><a href="/">Status Dashboard</a></li>
          <li><a href="/incidents">Incidents</a></li>
          <li><a href="/pricing">Pricing</a></li>
          <li><a href="/dashboard">Dashboard</a></li>
          <li><a href="/compare">Why APIdown</a></li>
        </ul>
      </div>

      <!-- Developers -->
      <div class="footer-col">
        <h4>Developers</h4>
        <ul>
          <li><a href="/docs">Documentation</a></li>
          <li><a href="/api-status">API Reference</a></li>
          <li><a href="https://github.com/dj-pearson/apidown" target="_blank" rel="noopener">GitHub</a></li>
          <li><a href="/docs#sdks">SDKs</a></li>
          <li><a href="/incidents/rss">RSS Feed</a></li>
        </ul>
      </div>

      <!-- Company -->
      <div class="footer-col">
        <h4>Company</h4>
        <ul>
          <li><a href="/login">Log In / Sign Up</a></li>
          <li><a href="/sitemap.xml">Sitemap</a></li>
          <li><a href="/llms.txt">LLMs.txt</a></li>
          <li><a href="/robots.txt">Robots.txt</a></li>
        </ul>
      </div>
    </div>

    <!-- Newsletter -->
    <div class="footer-newsletter">
      <div class="newsletter-content">
        <strong>Get weekly API reliability insights</strong>
        <p>Stay updated on outages, trends, and platform news.</p>
      </div>
      <form class="newsletter-form" onsubmit={submitNewsletter}>
        <input type="email" bind:value={newsletterEmail} placeholder="you@example.com" required disabled={newsletterSubmitting} />
        <button type="submit" disabled={newsletterSubmitting}>{newsletterSubmitting ? 'Subscribing...' : 'Subscribe'}</button>
      </form>
      {#if newsletterMsg}
        <p class="newsletter-msg">{newsletterMsg}</p>
      {/if}
    </div>

    <div class="footer-bottom">
      <p>&copy; {new Date().getFullYear()} Pearson Media LLC. All rights reserved.</p>
      <p class="footer-seo-text">APIdown monitors Stripe, OpenAI, AWS, Twilio, and 40+ APIs with crowd-sourced production traffic data.</p>
    </div>
  </div>
</footer>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid var(--color-border);
    background: rgba(30, 41, 59, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  nav {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    text-decoration: none;
  }

  .hamburger {
    display: none;
    flex-direction: column;
    gap: 4px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
  }

  .hamburger-line {
    display: block;
    width: 20px;
    height: 2px;
    background: var(--color-text);
    transition: transform 0.2s, opacity 0.2s;
  }

  .hamburger-line.open:nth-child(1) {
    transform: translateY(6px) rotate(45deg);
  }

  .hamburger-line.open:nth-child(2) {
    opacity: 0;
  }

  .hamburger-line.open:nth-child(3) {
    transform: translateY(-6px) rotate(-45deg);
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
  }

  .nav-links a {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    transition: color 0.15s;
  }

  .nav-links a:hover {
    color: var(--color-text);
    text-decoration: none;
  }

  .nav-links a.active {
    color: var(--color-primary);
  }

  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    min-height: calc(100vh - 130px);
  }

  footer {
    border-top: 1px solid var(--color-border);
    padding: 3rem 1.5rem 2rem;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    background: var(--color-surface);
  }

  .footer-inner {
    max-width: 1200px;
    margin: 0 auto;
  }

  .footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 2.5rem;
    margin-bottom: 2.5rem;
  }

  .footer-brand {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .footer-logo {
    display: inline-block;
  }

  .footer-tagline {
    line-height: 1.6;
    max-width: 300px;
  }

  .footer-col h4 {
    color: var(--color-text);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.85rem;
  }

  .footer-col ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .footer-col a {
    color: var(--color-text-muted);
    transition: color 0.15s;
    font-size: 0.85rem;
  }

  .footer-col a:hover {
    color: var(--color-text);
    text-decoration: none;
  }

  .footer-bottom {
    border-top: 1px solid var(--color-border);
    padding-top: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.78rem;
  }

  .footer-seo-text {
    color: var(--color-text-muted);
    opacity: 0.7;
  }

  /* Nav CTA button */
  .nav-cta-btn {
    background: var(--color-primary) !important;
    color: #fff !important;
    padding: 0.4rem 1rem !important;
    border-radius: 6px !important;
    font-weight: 600 !important;
    font-size: 0.85rem !important;
    transition: opacity 0.15s !important;
  }

  .nav-cta-btn:hover {
    opacity: 0.9;
    color: #fff !important;
  }

  /* Social links */
  .footer-social {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .footer-social a {
    color: var(--color-text-muted);
    transition: color 0.15s;
    display: flex;
    align-items: center;
  }

  .footer-social a:hover {
    color: var(--color-primary);
  }

  /* Newsletter */
  .footer-newsletter {
    border-top: 1px solid var(--color-border);
    padding-top: 1.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .newsletter-content {
    flex: 1;
    min-width: 200px;
  }

  .newsletter-content strong {
    display: block;
    color: var(--color-text);
    font-size: 0.9rem;
    margin-bottom: 0.2rem;
  }

  .newsletter-content p {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .newsletter-form {
    display: flex;
    gap: 0.5rem;
  }

  .newsletter-form input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.85rem;
    outline: none;
    width: 220px;
  }

  .newsletter-form input:focus {
    border-color: var(--color-primary);
  }

  .newsletter-form button {
    background: var(--color-primary);
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .newsletter-form button:hover {
    opacity: 0.9;
  }

  .newsletter-form button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .newsletter-msg {
    width: 100%;
    font-size: 0.8rem;
    color: var(--color-operational);
    margin-top: 0.25rem;
  }

  @media (max-width: 640px) {
    .hamburger {
      display: flex;
    }

    .nav-links {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      flex-direction: column;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      padding: 1rem 1.5rem;
      gap: 0.75rem;
    }

    .nav-links.mobile-open {
      display: flex;
    }

    nav {
      position: relative;
    }

    .footer-grid {
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .footer-brand {
      grid-column: 1 / -1;
    }

    .footer-bottom {
      flex-direction: column;
      text-align: center;
    }

    .footer-newsletter {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .newsletter-form {
      width: 100%;
      flex-direction: column;
    }

    .newsletter-form input {
      width: 100%;
    }
  }
</style>
