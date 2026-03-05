<script>
  let { error } = $props();
</script>

<svelte:head>
  <title>{error.status} — APIdown.net</title>
</svelte:head>

<div class="error-page">
  <h1>{error.status}</h1>
  <p>{error.message || 'Something went wrong.'}</p>
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
