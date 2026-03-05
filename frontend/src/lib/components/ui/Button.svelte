<script>
  let { variant = 'primary', size = 'md', disabled = false, href = '', onclick, children, ...rest } = $props();
</script>

{#if href}
  <a {href} class="btn btn-{variant} btn-{size}" class:disabled {...rest}>
    {@render children()}
  </a>
{:else}
  <button class="btn btn-{variant} btn-{size}" {disabled} {onclick} {...rest}>
    {@render children()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    text-decoration: none;
    transition: opacity 0.15s, border-color 0.15s;
  }

  .btn-md {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }

  .btn-sm {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    border-radius: 4px;
  }

  .btn-primary {
    background: var(--color-primary);
    color: #fff;
    border: none;
  }

  .btn-primary:hover { opacity: 0.9; }
  .btn-primary:disabled, .btn-primary.disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover { border-color: var(--color-text-muted); }

  .btn-danger {
    background: none;
    color: var(--color-down);
    border: 1px solid var(--color-down);
  }

  .btn-danger:hover { background: rgba(239, 68, 68, 0.1); }

  .btn-ghost {
    background: none;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
  }

  .btn-ghost:hover { color: var(--color-text); border-color: var(--color-primary); }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
