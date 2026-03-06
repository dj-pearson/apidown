<script>
  import { friendlyAuthError } from '$lib/auth-errors.js';
  import { createClient } from '@supabase/supabase-js';

  let mode = $state('login'); // 'login' or 'register'
  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  // MFA challenge state
  let mfaRequired = $state(false);
  let mfaCode = $state('');
  let mfaFactorId = $state('');
  let mfaChallengeId = $state('');
  let mfaVerifying = $state(false);
  let supabaseClient = $state(null);

  async function handleSubmit() {
    loading = true;
    errorMsg = '';
    successMsg = '';

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, mode }),
      });
      const result = await res.json();

      if (!res.ok) {
        // Check if MFA is required — Supabase returns a specific error
        if (result.mfa_required) {
          // We need a client-side Supabase instance for MFA
          supabaseClient = createClient(result.supabase_url, result.supabase_anon_key);
          // Sign in client-side to get the MFA session
          const { data: signInData, error: signInErr } = await supabaseClient.auth.signInWithPassword({
            email, password,
          });

          if (signInErr) {
            errorMsg = friendlyAuthError(signInErr.message);
            loading = false;
            return;
          }

          // Get the TOTP factor to challenge
          const { data: factorsData } = await supabaseClient.auth.mfa.listFactors();
          const totpFactor = factorsData?.totp?.[0];
          if (!totpFactor) {
            errorMsg = 'MFA factor not found. Contact support.';
            loading = false;
            return;
          }
          mfaFactorId = totpFactor.id;

          // Create a challenge
          const { data: challengeData, error: challengeErr } = await supabaseClient.auth.mfa.challenge({
            factorId: mfaFactorId,
          });
          if (challengeErr) {
            errorMsg = challengeErr.message;
            loading = false;
            return;
          }
          mfaChallengeId = challengeData.id;
          mfaRequired = true;
          loading = false;
          return;
        }

        errorMsg = friendlyAuthError(result.error || 'Something went wrong.');
      } else if (mode === 'register') {
        successMsg = result.message || 'Check your email for a confirmation link.';
      } else {
        // Login succeeded — cookies set server-side, navigate to dashboard
        window.location.href = '/dashboard';
        return;
      }
    } catch {
      errorMsg = 'Something went wrong. Please try again.';
    }
    loading = false;
  }

  async function handleMfaVerify() {
    mfaVerifying = true;
    errorMsg = '';
    try {
      const { data: verifyData, error: verifyErr } = await supabaseClient.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode,
      });
      if (verifyErr) {
        errorMsg = 'Invalid code. Please try again.';
        mfaVerifying = false;
        return;
      }

      // MFA verified — send the new session tokens to the server to set cookies
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const session = sessionData?.session;
      if (session) {
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });
        window.location.href = '/dashboard';
        return;
      }

      errorMsg = 'Session error after MFA. Please try again.';
    } catch {
      errorMsg = 'Verification failed. Please try again.';
    }
    mfaVerifying = false;
  }
</script>

<svelte:head>
  <title>{mfaRequired ? 'Verify 2FA' : mode === 'login' ? 'Log In' : 'Sign Up'} — APIdown.net</title>
  <meta name="description" content="Sign in or create a free APIdown.net account to manage API keys, set up alerts, and monitor your API dependencies." />
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="auth-page">
  <div class="auth-card">
    {#if mfaRequired}
      <h1>Two-Factor Authentication</h1>
      <p class="subtitle">Enter the 6-digit code from your authenticator app.</p>

      <form onsubmit={(e) => { e.preventDefault(); handleMfaVerify(); }}>
        <input
          type="text"
          bind:value={mfaCode}
          placeholder="000000"
          maxlength="6"
          pattern="[0-9]*"
          inputmode="numeric"
          autocomplete="one-time-code"
          class="mfa-input"
          required
        />
        <button type="submit" disabled={mfaVerifying || mfaCode.length !== 6}>
          {mfaVerifying ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      {#if errorMsg}
        <p class="error">{errorMsg}</p>
      {/if}

      <p class="toggle">
        <button class="link-btn" onclick={() => { mfaRequired = false; mfaCode = ''; errorMsg = ''; }}>Back to login</button>
      </p>
    {:else}
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
    {/if}
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

  .mfa-input {
    font-size: 1.5rem;
    font-family: var(--font-mono, monospace);
    letter-spacing: 0.3em;
    text-align: center;
    padding: 0.75rem;
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
