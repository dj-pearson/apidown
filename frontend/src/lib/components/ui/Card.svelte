<script>
  let { header = '', padding = true, hover = false, children } = $props();
</script>

<div class="card" class:card-hover={hover} class:card-padded={padding}>
  {#if header}
    <div class="card-header">{header}</div>
  {/if}
  {@render children()}
</div>

<style>
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
  }

  .card-padded {
    padding: 1.25rem;
  }

  .card-hover {
    transition: border-color 0.15s;
  }

  .card-hover:hover {
    border-color: var(--color-primary);
  }

  .card-header {
    font-weight: 600;
    font-size: 0.95rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-border);
  }
</style>
