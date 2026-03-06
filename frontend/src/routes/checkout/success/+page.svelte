<svelte:head>
  <title>Subscription Active — APIdown.net</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="success-page">
  <div class="success-card">
    <div class="icon">&#10003;</div>
    <h1>You're all set!</h1>
    <p>Your subscription is now active. Your account has been upgraded and all premium features are available immediately.</p>
    <a href="/dashboard" class="btn-primary">Go to Dashboard</a>
  </div>
</div>

<style>
  .success-page {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 50vh;
  }

  .success-card {
    text-align: center;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 3rem 2rem;
    max-width: 480px;
  }

  .icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--color-operational);
    color: #fff;
    font-size: 2rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  p {
    color: var(--color-text-muted);
    margin-bottom: 2rem;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .btn-primary {
    display: inline-block;
    background: var(--color-primary);
    color: #fff;
    border: none;
    padding: 0.6rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    text-decoration: none;
  }

  .btn-primary:hover {
    opacity: 0.9;
    text-decoration: none;
  }
</style>
