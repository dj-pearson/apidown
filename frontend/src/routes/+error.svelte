<script>
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.error?.status || 'Error'} — APIdown.net</title>
</svelte:head>

<div class="error-page">
  <h1>{page.error?.status || 'Error'}</h1>
  <p>{page.error?.message || 'Something went wrong.'}</p>
  <a href="/">&larr; Back to dashboard</a>
</div>

<style>
  .error-page {
    text-align: center;
    padding: 6rem 1rem;
  }

  h1 {
    font-size: 4rem;
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: 0.5rem;
  }

  p {
    color: var(--color-text-muted);
    font-size: 1.1rem;
    margin-bottom: 2rem;
  }

  a {
    color: var(--color-primary);
    font-size: 0.9rem;
  }
</style>
