<script>
  let { message = '', variant = 'info', timeout = 5000, onclose = () => {} } = $props();

  const colors = {
    success: 'var(--color-operational)',
    error: 'var(--color-down)',
    info: 'var(--color-primary)',
  };

  $effect(() => {
    if (variant === 'error') return; // errors persist
    if (timeout > 0) {
      const timer = setTimeout(onclose, timeout);
      return () => clearTimeout(timer);
    }
  });
</script>

{#if message}
  <div class="toast" style="border-left-color: {colors[variant] || colors.info}" role="alert">
    <span class="toast-message">{message}</span>
    <button class="toast-close" onclick={onclose} aria-label="Dismiss">&times;</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 4px solid;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 400px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    z-index: 200;
    animation: toast-in 0.2s ease-out;
  }

  @keyframes toast-in {
    from { transform: translateY(1rem); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .toast-message {
    font-size: 0.85rem;
    color: var(--color-text);
    flex: 1;
  }

  .toast-close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.2rem;
    padding: 0;
    line-height: 1;
    cursor: pointer;
  }

  .toast-close:hover {
    color: var(--color-text);
  }
</style>
