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

  function isActive(href) {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
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
      onclick={() => mobileMenuOpen = !mobileMenuOpen}
      aria-label="Toggle navigation menu"
      aria-expanded={mobileMenuOpen}
      aria-controls="nav-links"
    >
      <span class="hamburger-line" class:open={mobileMenuOpen}></span>
      <span class="hamburger-line" class:open={mobileMenuOpen}></span>
      <span class="hamburger-line" class:open={mobileMenuOpen}></span>
    </button>
    <div id="nav-links" class="nav-links" class:mobile-open={mobileMenuOpen}>
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
        <a href="/login" class:active={isActive('/login')} onclick={() => mobileMenuOpen = false}>Log In</a>
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
      </div>

      <!-- Product -->
      <div class="footer-col">
        <h4>Product</h4>
        <ul>
          <li><a href="/">Status Dashboard</a></li>
          <li><a href="/incidents">Incidents</a></li>
          <li><a href="/pricing">Pricing</a></li>
          <li><a href="/dashboard">Dashboard</a></li>
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
  }
</style>
