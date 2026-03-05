<script>
  import '../app.css';
  let { children } = $props();
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
    <div class="nav-links">
      <a href="/">Status</a>
      <a href="/incidents">Incidents</a>
      <a href="/docs">Docs</a>
    </div>
  </nav>
</header>

<main>
  {@render children()}
</main>

<footer>
  <p>Real API status. From real traffic. &copy; {new Date().getFullYear()} Pearson Media LLC</p>
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

  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    min-height: calc(100vh - 130px);
  }

  footer {
    border-top: 1px solid var(--color-border);
    text-align: center;
    padding: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }
</style>
