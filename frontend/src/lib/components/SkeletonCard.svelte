<div class="skeleton-card">
  <div class="skeleton-header">
    <div class="skeleton-circle"></div>
    <div class="skeleton-line skeleton-name"></div>
    <div class="skeleton-line skeleton-sparkline"></div>
  </div>
  <div class="skeleton-status">
    <div class="skeleton-circle skeleton-dot"></div>
    <div class="skeleton-line skeleton-label"></div>
  </div>
</div>

<style>
  .skeleton-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1rem;
    min-height: 90px;
  }

  .skeleton-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .skeleton-circle {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: var(--color-surface-hover);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .skeleton-line {
    height: 12px;
    border-radius: 4px;
    background: var(--color-surface-hover);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-name {
    width: 100px;
    height: 14px;
  }

  .skeleton-sparkline {
    width: 80px;
    height: 20px;
    margin-left: auto;
  }

  .skeleton-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }

  .skeleton-label {
    width: 70px;
    height: 10px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
</style>
