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

  // Password strength
  let passwordStrength = $derived.by(() => {
    if (!password || mode !== 'register') return null;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { label: 'Weak', color: 'var(--color-down)', pct: 20 };
    if (score <= 2) return { label: 'Fair', color: '#f97316', pct: 40 };
    if (score <= 3) return { label: 'Good', color: 'var(--color-degraded)', pct: 60 };
    if (score <= 4) return { label: 'Strong', color: 'var(--color-operational)', pct: 80 };
    return { label: 'Very strong', color: 'var(--color-operational)', pct: 100 };
  });

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
  <!-- Benefits panel (left on desktop, top on mobile) -->
  <div class="benefits-panel">
    <h2 class="benefits-heading">Monitor every API you depend on</h2>
    <ul class="benefits-list">
      <li class="benefit-item">
        <span class="benefit-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </span>
        <div>
          <strong>Free Forever</strong>
          <span class="benefit-desc">Monitor 40+ APIs at no cost</span>
        </div>
      </li>
      <li class="benefit-item">
        <span class="benefit-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </span>
        <div>
          <strong>Instant Alerts</strong>
          <span class="benefit-desc">Get notified before vendors acknowledge issues</span>
        </div>
      </li>
      <li class="benefit-item">
        <span class="benefit-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </span>
        <div>
          <strong>Production Data</strong>
          <span class="benefit-desc">Real traffic signals, not synthetic pings</span>
        </div>
      </li>
      <li class="benefit-item">
        <span class="benefit-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </span>
        <div>
          <strong>One Dashboard</strong>
          <span class="benefit-desc">All your API dependencies in one place</span>
        </div>
      </li>
    </ul>
    <p class="trust-metric">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-operational)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Trusted by <strong>10,000+</strong> developers
    </p>
  </div>

  <!-- Auth form (right on desktop, bottom on mobile) -->
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

      <!-- GitHub OAuth button -->
      <a href="/auth/oauth/github" class="github-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
        Continue with GitHub
      </a>

      <div class="divider">
        <span>or continue with email</span>
      </div>

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
        {#if passwordStrength}
          <div class="password-strength" aria-label="Password strength: {passwordStrength.label}">
            <div class="strength-bar">
              <div class="strength-fill" style="width: {passwordStrength.pct}%; background: {passwordStrength.color}"></div>
            </div>
            <span class="strength-label" style="color: {passwordStrength.color}">{passwordStrength.label}</span>
          </div>
          <div class="password-hints">
            <span class:met={password.length >= 6}>6+ characters</span>
            <span class:met={/[A-Z]/.test(password)}>Uppercase</span>
            <span class:met={/[0-9]/.test(password)}>Number</span>
            <span class:met={/[^A-Za-z0-9]/.test(password)}>Special char</span>
          </div>
        {/if}
        {#if mode === 'login'}
          <div class="forgot-password">
            <a href="/auth/forgot-password">Forgot password?</a>
          </div>
        {/if}
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
    align-items: stretch;
    gap: 2rem;
    padding: 2rem 1rem;
    max-width: 900px;
    margin: 0 auto;
  }

  /* Benefits panel */
  .benefits-panel {
    flex: 1;
    max-width: 380px;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .benefits-heading {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 1.5rem;
    line-height: 1.3;
  }

  .benefits-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .benefit-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .benefit-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(6, 182, 212, 0.12);
    border-radius: 8px;
    color: var(--color-primary);
  }

  .benefit-item strong {
    display: block;
    font-size: 0.9rem;
    color: var(--color-text);
    margin-bottom: 0.1rem;
  }

  .benefit-desc {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .trust-metric {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 2rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .trust-metric strong {
    color: var(--color-text);
  }

  /* Auth card */
  .auth-card {
    width: 100%;
    max-width: 400px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 2rem;
    align-self: center;
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

  /* GitHub OAuth button */
  .github-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .github-btn:hover {
    border-color: var(--color-text-muted);
  }

  /* Divider */
  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 1.25rem 0;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }

  .divider span {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    white-space: nowrap;
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

  /* Forgot password link */
  .forgot-password {
    text-align: right;
    margin-top: -0.5rem;
  }

  .forgot-password a {
    font-size: 0.8rem;
    color: var(--color-primary);
    text-decoration: none;
  }

  .forgot-password a:hover {
    text-decoration: underline;
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

  /* Password strength */
  .password-strength {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: -0.5rem;
  }

  .strength-bar {
    flex: 1;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
    overflow: hidden;
  }

  .strength-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.2s, background 0.2s;
  }

  .strength-label {
    font-size: 0.7rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .password-hints {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-top: -0.5rem;
  }

  .password-hints span {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    opacity: 0.5;
    transition: opacity 0.15s, color 0.15s;
  }

  .password-hints span.met {
    color: var(--color-operational);
    opacity: 1;
  }

  /* Mobile: stack vertically */
  @media (max-width: 768px) {
    .auth-page {
      flex-direction: column;
      align-items: center;
      padding: 1rem;
    }

    .benefits-panel {
      max-width: 100%;
      width: 100%;
    }

    .auth-card {
      max-width: 100%;
    }
  }
</style>
