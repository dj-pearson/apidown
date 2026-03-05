<script>
  import { createClient } from '@supabase/supabase-js';
  import { page } from '$app/state';

  let mode = $state('login'); // 'login' or 'register'
  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  function getAuthClient() {
    const url = page.data?.supabaseUrl;
    const key = page.data?.supabaseAnonKey;
    if (!url || !key) return null;
    return createClient(url, key);
  }

  async function handleSubmit() {
    loading = true;
    errorMsg = '';
    successMsg = '';

    const supabase = getAuthClient();
    if (!supabase) {
      errorMsg = 'Authentication service unavailable. Please refresh the page.';
      loading = false;
      return;
    }

    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        errorMsg = error.message;
      } else {
        // Set cookies via server endpoint so server-side auth works
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          }),
        });
        // Full page navigation to ensure cookies are sent
        window.location.href = '/dashboard';
        return;
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        errorMsg = error.message;
      } else {
        successMsg = 'Check your email for a confirmation link.';
      }
    }
    loading = false;
  }
</script>

<svelte:head>
  <title>{mode === 'login' ? 'Log In' : 'Sign Up'} — APIdown.net</title>
</svelte:head>

<div class="auth-page">
  <div class="auth-card">
    <h1>{mode === 'login' ? 'Log In' : 'Create Account'}</h1>
    <p class="subtitle">
      {mode === 'login' ? 'Sign in to manage your API keys and alerts.' : 'Create a free account to get started.'}
    </p>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <label>
        Email
        <input type="email" bind:value={email} required placeholder="you@example.com" autocomplete="email" />
      </label>
      <label>
        Password
        <div class="password-field">
          <input type={showPassword ? 'text' : 'password'} bind:value={password} required minlength="6" placeholder="Min 6 characters" autocomplete={mode === 'login' ? 'current-password' : 'new-password'} />
          <button type="button" class="toggle-password" onclick={() => showPassword = !showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Sign Up'}
      </button>
    </form>

    {#if errorMsg}
      <p class="error">{errorMsg}</p>
    {/if}
    {#if successMsg}
      <p class="success">{successMsg}</p>
    {/if}

    <p class="toggle">
      {#if mode === 'login'}
        Don't have an account? <button class="link-btn" onclick={() => { mode = 'register'; errorMsg = ''; successMsg = ''; }}>Sign Up</button>
      {:else}
        Already have an account? <button class="link-btn" onclick={() => { mode = 'login'; errorMsg = ''; successMsg = ''; }}>Log In</button>
      {/if}
    </p>
  </div>
</div>

<style>
  .auth-page {
    display: flex;
    justify-content: center;
    padding-top: 2rem;
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 2rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text);
  }

  input {
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.9rem;
    outline: none;
  }

  input:focus {
    border-color: var(--color-primary);
  }

  button[type="submit"] {
    background: var(--color-primary);
    color: #fff;
    border: none;
    padding: 0.6rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 0.5rem;
  }

  button[type="submit"]:hover { opacity: 0.9; }
  button[type="submit"]:disabled { opacity: 0.5; cursor: not-allowed; }

  .error {
    color: var(--color-down);
    font-size: 0.85rem;
    margin-top: 0.75rem;
  }

  .success {
    color: var(--color-operational);
    font-size: 0.85rem;
    margin-top: 0.75rem;
  }

  .toggle {
    text-align: center;
    margin-top: 1.5rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--color-primary);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0;
  }

  .link-btn:hover { text-decoration: underline; }

  .password-field {
    position: relative;
    display: flex;
  }

  .password-field input {
    flex: 1;
    padding-right: 3.5rem;
  }

  .toggle-password {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.4rem;
  }

  .toggle-password:hover {
    color: var(--color-primary);
  }
</style>
