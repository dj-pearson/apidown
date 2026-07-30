<script>
  import SEO from '$lib/components/SEO.svelte';

  let { data } = $props();
</script>

<SEO
  title="Unsubscribe — APIdown.net"
  description="Unsubscribe from the APIdown weekly digest."
  canonical="https://apidown.net/newsletter/unsubscribe"
  noindex={true}
/>

<div class="panel" class:error={data.status === 'error'}>
  <h1>{data.status === 'success' ? 'Unsubscribed' : 'Something went wrong'}</h1>
  <p>{data.message}</p>

  {#if data.status === 'success'}
    <p class="note">
      You can still read every edition on the web at <a href="/weekly">/weekly</a>, and the
      <a href="/incidents/rss">incident feeds</a> need no email at all.
    </p>
  {/if}

  <a href="/" class="btn">Back to the status dashboard</a>
</div>

<style>
  .panel {
    max-width: 520px;
    margin: 3rem auto;
    background: var(--color-surface);
    border: 1px solid color-mix(in srgb, var(--color-operational) 35%, var(--color-border));
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
  }

  .panel.error {
    border-color: color-mix(in srgb, var(--color-down) 40%, var(--color-border));
  }

  h1 {
    font-size: 1.35rem;
    margin-bottom: 0.6rem;
  }

  p {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .note {
    margin-top: 0.85rem;
    font-size: 0.82rem;
  }

  .btn {
    display: inline-block;
    margin-top: 1.5rem;
    background: var(--color-primary);
    color: #fff;
    border-radius: 6px;
    padding: 0.5rem 1.1rem;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
  }

  .btn:hover { opacity: 0.9; color: #fff; text-decoration: none; }
</style>
