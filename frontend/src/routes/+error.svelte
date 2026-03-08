<script>
  import { page } from '$app/state';
  import { goto } from '$app/navigation';

  let searchQuery = $state('');
  let status = $derived(page.error?.status || 'Error');
  let message = $derived(page.error?.message || 'Something went wrong.');

  let heading = $derived(status === 404
    ? 'Page Not Found'
    : status === 500
      ? 'Server Error'
      : `Error ${status}`
  );

  let subtitle = $derived(status === 404
    ? 'The page you\'re looking for doesn\'t exist or may have been moved.'
    : message
  );

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim()) {
      goto(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  const popularApis = [
    { name: 'Stripe', slug: 'stripe' },
    { name: 'OpenAI', slug: 'openai' },
    { name: 'AWS S3', slug: 'aws-s3' },
    { name: 'Twilio', slug: 'twilio' },
    { name: 'GitHub', slug: 'github' },
    { name: 'Cloudflare', slug: 'cloudflare' },
  ];
</script>

<svelte:head>
  <title>{status} — APIdown.net</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="error-page">
  <div class="error-icon">{status === 404 ? '404' : '!'}</div>
  <h1>{heading}</h1>
  <p class="error-subtitle">{subtitle}</p>

  <form class="error-search" onsubmit={handleSearch}>
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search for an API..."
      aria-label="Search APIs"
    />
    <button type="submit">Search</button>
  </form>

  <div class="error-links">
    <h2>Popular APIs</h2>
    <div class="api-chips">
      {#each popularApis as api}
        <a href="/api/{api.slug}" class="api-chip">{api.name}</a>
      {/each}
    </div>
  </div>

  <div class="error-nav">
    <a href="/">Status Dashboard</a>
    <a href="/incidents">Incidents</a>
    <a href="/docs">Documentation</a>
    <a href="/pricing">Pricing</a>
  </div>
</div>

<style>
  .error-page {
    text-align: center;
    padding: 4rem 1rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .error-icon {
    font-size: 3.5rem;
    font-weight: 800;
    color: var(--color-primary);
    margin-bottom: 1rem;
    opacity: 0.8;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .error-subtitle {
    color: var(--color-text-muted);
    font-size: 1rem;
    margin-bottom: 2rem;
    line-height: 1.5;
  }

  .error-search {
    display: flex;
    gap: 0.5rem;
    max-width: 400px;
    margin: 0 auto 2.5rem;
  }

  .error-search input {
    flex: 1;
    padding: 0.65rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.9rem;
    outline: none;
  }

  .error-search input:focus {
    border-color: var(--color-primary);
  }

  .error-search button {
    padding: 0.65rem 1.25rem;
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }

  .error-search button:hover {
    opacity: 0.9;
  }

  .error-links {
    margin-bottom: 2.5rem;
  }

  .error-links h2 {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    margin-bottom: 0.75rem;
  }

  .api-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }

  .api-chip {
    padding: 0.4rem 0.85rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    color: var(--color-text);
    font-size: 0.85rem;
    font-weight: 500;
    text-decoration: none;
    transition: border-color 0.15s, background 0.15s;
  }

  .api-chip:hover {
    border-color: var(--color-primary);
    background: rgba(99, 102, 241, 0.08);
  }

  .error-nav {
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    flex-wrap: wrap;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .error-nav a {
    color: var(--color-primary);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .error-nav a:hover {
    text-decoration: underline;
  }

  @media (max-width: 480px) {
    .error-search {
      flex-direction: column;
    }
  }
</style>
