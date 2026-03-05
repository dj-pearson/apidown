<script>
  let { data } = $props();
</script>

<svelte:head>
  <title>Unsubscribe — APIdown.net</title>
</svelte:head>

<div class="container">
  {#if data.status === 'success'}
    <div class="icon">&#10003;</div>
    <h1>Unsubscribed</h1>
    <p>{data.message}</p>
  {:else}
    <div class="icon error">&#10007;</div>
    <h1>Oops</h1>
    <p>{data.message}</p>
  {/if}
  <a href="/" class="home-link">&larr; Back to dashboard</a>
</div>

<style>
  .container {
    text-align: center;
    padding: 4rem 1rem;
  }

  .icon {
    font-size: 3rem;
    width: 80px;
    height: 80px;
    line-height: 80px;
    border-radius: 50%;
    margin: 0 auto 1.5rem;
    background: var(--color-operational);
    color: #000;
  }

  .icon.error {
    background: var(--color-down);
    color: #fff;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  p {
    color: var(--color-text-muted);
    margin-bottom: 2rem;
  }

  .home-link {
    color: var(--color-primary);
    font-size: 0.9rem;
  }
</style>
