<script>
  import '../app.css';
  import { page } from '$app/state';
  let { children } = $props();

  let mobileMenuOpen = $state(false);

  function isActive(href) {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
  }
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<header>
  <nav>
    <a href="/" class="logo">
      <span class="logo-text">API<span class="logo-accent">down</span>.net</span>
    </a>
    <button class="hamburger" onclick={() => mobileMenuOpen = !mobileMenuOpen} aria-label="Toggle menu">
      <span class="hamburger-line" class:open={mobileMenuOpen}></span>
      <span class="hamburger-line" class:open={mobileMenuOpen}></span>
      <span class="hamburger-line" class:open={mobileMenuOpen}></span>
    </button>
    <div class="nav-links" class:mobile-open={mobileMenuOpen}>
      <a href="/" class:active={isActive('/')} onclick={() => mobileMenuOpen = false}>Status</a>
      <a href="/incidents" class:active={isActive('/incidents')} onclick={() => mobileMenuOpen = false}>Incidents</a>
      <a href="/docs" class:active={isActive('/docs')} onclick={() => mobileMenuOpen = false}>Docs</a>
      <a href="/get-key" class:active={isActive('/get-key')} onclick={() => mobileMenuOpen = false}>Get API Key</a>
    </div>
  </nav>
</header>

<main>
  {@render children()}
</main>

<footer>
  <div class="footer-content">
    <p>&copy; {new Date().getFullYear()} Pearson Media LLC &middot; Real API status from real traffic.</p>
    <div class="footer-links">
      <a href="/api-status">API</a>
      <a href="/docs">Docs</a>
      <a href="https://github.com/dj-pearson/apidown" target="_blank" rel="noopener">GitHub</a>
    </div>
  </div>
</footer>

<style>
  header {
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
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

  .logo-text {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .logo-accent {
    color: var(--color-primary);
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
    padding: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .footer-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-links {
    display: flex;
    gap: 1rem;
  }

  .footer-links a {
    color: var(--color-text-muted);
    transition: color 0.15s;
  }

  .footer-links a:hover {
    color: var(--color-text);
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

    .footer-content {
      flex-direction: column;
      gap: 0.75rem;
      text-align: center;
    }
  }
</style>
