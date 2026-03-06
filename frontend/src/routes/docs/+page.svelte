<script>
  let copiedIndex = $state(null);
  let copiedTimeout;

  const codeBlocks = [
    'npm install apidown-monitor',
    "import apidown from 'apidown-monitor';\n\napidown.init({ key: 'YOUR_SDK_KEY' });\n\n// That's it — all fetch() and axios calls are automatically monitored.",
    "const apidown = require('apidown-monitor');\napidown.init({ key: process.env.APIDOWN_KEY });\n\nconst express = require('express');\nconst app = express();\n\n// All outbound API calls are now monitored",
    "// lib/apidown.js\nimport apidown from 'apidown-monitor';\n\nif (typeof window === 'undefined') {\n  if (!global._apidownInit) {\n    apidown.init({ key: process.env.APIDOWN_KEY });\n    global._apidownInit = true;\n  }\n}",
    "// src/hooks.server.js\nimport apidown from 'apidown-monitor';\napidown.init({ key: import.meta.env.APIDOWN_KEY });",
    'pip install apidown',
    "import apidown\n\napidown.init(key='YOUR_SDK_KEY')\n\n# All requests and httpx calls are automatically monitored.",
    "# manage.py or wsgi.py\nimport apidown, os\napidown.init(key=os.environ['APIDOWN_KEY'])\n\n# All requests library calls automatically reported",
    "import apidown, os\napidown.init(key=os.environ['APIDOWN_KEY'])\n\nfrom fastapi import FastAPI\nimport httpx\n\napp = FastAPI()\n\n# httpx.Client is auto-patched",
    "// JavaScript\nconst start = Date.now();\ntry {\n  const res = await myClient.get('https://api.stripe.com/v1/charges');\n  apidown.record('api.stripe.com', res.statusCode, Date.now() - start);\n} catch (e) {\n  apidown.record('api.stripe.com', 0, Date.now() - start);\n  throw e;\n}",
    "# Python\nimport apidown, time\nstart = time.time()\ntry:\n    resp = await session.get('https://api.stripe.com/v1/charges')\n    apidown.record('api.stripe.com', resp.status, int((time.time()-start)*1000))\nexcept Exception:\n    apidown.record('api.stripe.com', 0, int((time.time()-start)*1000))\n    raise",
  ];

  const tocSections = [
    { id: 'javascript', label: 'JavaScript / Node.js' },
    { id: 'python', label: 'Python' },
    { id: 'configuration', label: 'Configuration Options' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'manual-recording', label: 'Manual Recording' },
  ];

  let activeSection = $state('javascript');
  let tocOpen = $state(false);

  function copyCode(index) {
    navigator.clipboard.writeText(codeBlocks[index]);
    copiedIndex = index;
    clearTimeout(copiedTimeout);
    copiedTimeout = setTimeout(() => { copiedIndex = null; }, 2000);
  }

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    tocOpen = false;
  }

  $effect(() => {
    if (typeof window === 'undefined') return;
    function onScroll() {
      const ids = tocSections.map(s => s.id);
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && el.getBoundingClientRect().top <= 120) {
          activeSection = ids[i];
          return;
        }
      }
      activeSection = ids[0];
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });
</script>

<svelte:head>
  <title>SDK Documentation — APIdown.net</title>
  <meta name="description" content="Integrate the APIdown SDK into your application to contribute real-time API health signals." />
</svelte:head>

<!-- Mobile TOC dropdown -->
<div class="toc-mobile">
  <button class="toc-toggle" onclick={() => tocOpen = !tocOpen} aria-expanded={tocOpen}>
    Sections {tocOpen ? '▲' : '▼'}
  </button>
  {#if tocOpen}
    <nav class="toc-dropdown" aria-label="Table of contents">
      {#each tocSections as sec}
        <button class:active={activeSection === sec.id} onclick={() => scrollToSection(sec.id)}>{sec.label}</button>
      {/each}
    </nav>
  {/if}
</div>

<div class="docs-layout">
  <!-- Desktop TOC sidebar -->
  <nav class="toc-sidebar" aria-label="Table of contents">
    <span class="toc-heading">Contents</span>
    {#each tocSections as sec}
      <button class:active={activeSection === sec.id} onclick={() => scrollToSection(sec.id)}>{sec.label}</button>
    {/each}
  </nav>

  <article class="docs">
    <h1>SDK Integration Guide</h1>
    <p class="lead">Start contributing real-time API health signals with a single line of code.</p>

  <section id="javascript">
    <h2>JavaScript / Node.js</h2>

    <h3>Install</h3>
    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(0)}>{copiedIndex === 0 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[0]}</code></pre>
    </div>

    <h3>Initialize</h3>
    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(1)}>{copiedIndex === 1 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[1]}</code></pre>
    </div>

    <h3>Express / Node.js</h3>
    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(2)}>{copiedIndex === 2 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[2]}</code></pre>
    </div>

    <h3>Next.js</h3>
    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(3)}>{copiedIndex === 3 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[3]}</code></pre>
    </div>

    <h3>SvelteKit</h3>
    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(4)}>{copiedIndex === 4 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[4]}</code></pre>
    </div>
  </section>

  <section id="python">
    <h2>Python</h2>

    <h3>Install</h3>
    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(5)}>{copiedIndex === 5 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[5]}</code></pre>
    </div>

    <h3>Initialize</h3>
    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(6)}>{copiedIndex === 6 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[6]}</code></pre>
    </div>

    <h3>Django</h3>
    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(7)}>{copiedIndex === 7 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[7]}</code></pre>
    </div>

    <h3>FastAPI</h3>
    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(8)}>{copiedIndex === 8 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[8]}</code></pre>
    </div>
  </section>

  <section id="configuration">
    <h2>Configuration Options</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Option</th><th>Default</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>key</code></td><td>—</td><td>Required. Your SDK key from apidown.net/dashboard</td></tr>
          <tr><td><code>endpoint</code></td><td>ingest.apidown.net</td><td>Override the ingest endpoint</td></tr>
          <tr><td><code>flushInterval</code></td><td>30000</td><td>Milliseconds between batched transmissions</td></tr>
          <tr><td><code>maxBatchSize</code></td><td>100</td><td>Maximum signals per batch</td></tr>
          <tr><td><code>allowlist</code></td><td>[]</td><td>Only monitor these domains</td></tr>
          <tr><td><code>denylist</code></td><td>[]</td><td>Never monitor these domains</td></tr>
          <tr><td><code>debug</code></td><td>false</td><td>Enable console logging</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section id="privacy">
    <h2>Privacy</h2>
    <p>APIdown <strong>never</strong> captures request payloads, headers, authentication tokens, or any user data. Only domain, HTTP status code, response duration (ms), and timestamp are transmitted. All data is anonymized at the SDK level before transmission.</p>
  </section>

  <section id="manual-recording">
    <h2>Manual Recording</h2>
    <p>For custom HTTP clients not auto-patched by the SDK:</p>

    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(9)}>{copiedIndex === 9 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[9]}</code></pre>
    </div>

    <div class="code-block">
      <button class="copy-btn" onclick={() => copyCode(10)}>{copiedIndex === 10 ? 'Copied!' : 'Copy'}</button>
      <pre><code>{codeBlocks[10]}</code></pre>
    </div>
  </section>
  </article>
</div>

<style>
  .docs-layout {
    display: flex;
    gap: 2rem;
    max-width: 1000px;
    margin: 0 auto;
  }

  .toc-sidebar {
    position: sticky;
    top: 5rem;
    align-self: flex-start;
    width: 200px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .toc-heading {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  .toc-sidebar button {
    background: none;
    border: none;
    text-align: left;
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    border-left: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .toc-sidebar button:hover {
    color: var(--color-text);
  }

  .toc-sidebar button.active {
    color: var(--color-primary);
    border-left-color: var(--color-primary);
  }

  .toc-mobile {
    display: none;
    margin-bottom: 1.5rem;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  .toc-toggle {
    width: 100%;
    padding: 0.6rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text);
    font-size: 0.85rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  .toc-dropdown {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-top: none;
    border-radius: 0 0 8px 8px;
  }

  .toc-dropdown button {
    background: none;
    border: none;
    text-align: left;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .toc-dropdown button:hover {
    background: var(--color-surface-hover);
  }

  .toc-dropdown button.active {
    color: var(--color-primary);
  }

  @media (max-width: 768px) {
    .toc-sidebar {
      display: none;
    }

    .toc-mobile {
      display: block;
    }

    .docs-layout {
      display: block;
    }
  }

  .docs {
    max-width: 800px;
    flex: 1;
    min-width: 0;
  }

  h1 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
  }

  .lead {
    color: var(--color-text-muted);
    font-size: 1.05rem;
    margin-bottom: 2.5rem;
  }

  section {
    margin-bottom: 2.5rem;
  }

  h2 {
    font-size: 1.25rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  h3 {
    font-size: 0.95rem;
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
    margin-top: 1.25rem;
  }

  .code-block {
    position: relative;
    margin-bottom: 1rem;
  }

  .copy-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: var(--color-surface-hover);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    z-index: 1;
    transition: color 0.15s, border-color 0.15s;
  }

  .copy-btn:hover {
    color: var(--color-text);
    border-color: var(--color-primary);
  }

  pre {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
    padding-right: 4rem;
    overflow-x: auto;
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 0;
  }

  code {
    font-family: var(--font-mono);
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  th, td {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--color-border);
  }

  th {
    color: var(--color-text-muted);
    font-weight: 600;
  }

  td code {
    background: var(--color-bg);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.8rem;
  }
</style>
