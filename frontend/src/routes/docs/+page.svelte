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
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'javascript', label: 'JavaScript / Node.js' },
    { id: 'python', label: 'Python' },
    { id: 'configuration', label: 'Configuration Options' },
    { id: 'rest-api', label: 'REST API Reference' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'manual-recording', label: 'Manual Recording' },
    { id: 'troubleshooting', label: 'Troubleshooting' },
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
  <meta name="description" content="Integrate the APIdown SDK into your JavaScript, Node.js, or Python application to contribute real-time API health signals. One-line setup for Express, Next.js, SvelteKit, Django, and FastAPI." />
  {@html `<script type="application/ld+json">${JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "APIdown SDK Integration Guide",
      "description": "Integrate the APIdown SDK into your application to contribute real-time API health signals",
      "url": "https://apidown.net/docs",
      "author": { "@type": "Organization", "name": "APIdown.net", "url": "https://apidown.net" },
      "publisher": { "@type": "Organization", "name": "APIdown.net", "url": "https://apidown.net" },
      "proficiencyLevel": "Beginner",
      "programmingLanguage": ["JavaScript", "Python"],
      "dependencies": "apidown-monitor (npm), apidown (pip)"
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": "How to integrate APIdown SDK into your application",
      "description": "Step-by-step guide to add real-time API health monitoring to your JavaScript or Python application.",
      "step": [
        { "@type": "HowToStep", "position": 1, "name": "Install the SDK", "text": "Run npm install apidown-monitor (JavaScript) or pip install apidown (Python) to add the SDK to your project." },
        { "@type": "HowToStep", "position": 2, "name": "Initialize with your API key", "text": "Import the SDK and call init() with your API key. All outbound HTTP calls are automatically monitored." },
        { "@type": "HowToStep", "position": 3, "name": "Deploy and monitor", "text": "Deploy your application. API health signals are automatically reported to APIdown from real production traffic." }
      ],
      "tool": [
        { "@type": "HowToTool", "name": "npm or pip" },
        { "@type": "HowToTool", "name": "APIdown SDK key" }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://apidown.net" },
        { "@type": "ListItem", "position": 2, "name": "Documentation", "item": "https://apidown.net/docs" }
      ]
    }
  ])}</script>`}
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
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        <li aria-current="page">Documentation</li>
      </ol>
    </nav>

    <h1>SDK Integration Guide</h1>
    <p class="lead">Start contributing real-time API health signals with a single line of code.</p>

  <section id="getting-started">
    <h2>Getting Started</h2>
    <p>Get up and running with APIdown in three steps:</p>

    <div class="quickstart-steps">
      <div class="qs-step">
        <span class="qs-num">1</span>
        <div>
          <strong>Create a free account</strong>
          <p>Sign up at <a href="/login">apidown.net/login</a> and generate an API key from your <a href="/dashboard">dashboard</a>.</p>
        </div>
      </div>
      <div class="qs-step">
        <span class="qs-num">2</span>
        <div>
          <strong>Install the SDK</strong>
          <p>Run <code>npm install apidown-monitor</code> (JavaScript) or <code>pip install apidown</code> (Python).</p>
        </div>
      </div>
      <div class="qs-step">
        <span class="qs-num">3</span>
        <div>
          <strong>Initialize and deploy</strong>
          <p>Call <code>apidown.init(&#123; key: 'YOUR_KEY' &#125;)</code> in your app entry point. All outbound HTTP calls are automatically monitored.</p>
        </div>
      </div>
    </div>
  </section>

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

  <section id="rest-api">
    <h2>REST API Reference</h2>
    <p>APIdown provides public REST endpoints for programmatic access to status data.</p>

    <h3>Get API Status</h3>
    <div class="api-endpoint">
      <span class="method get">GET</span>
      <code>/api-status/&#123;slug&#125;</code>
    </div>
    <p>Returns JSON status for a specific API. No authentication required.</p>

    <h3>Submit Signals</h3>
    <div class="api-endpoint">
      <span class="method post">POST</span>
      <code>/v1/signals</code>
    </div>
    <p>Submit a batch of monitoring signals. Requires <code>X-APIdown-Key</code> header with your SDK key.</p>

    <h3>Generate API Key</h3>
    <div class="api-endpoint">
      <span class="method post">POST</span>
      <code>/v1/keys</code>
    </div>
    <p>Generate a new SDK key. Requires authentication via bearer token.</p>

    <h3>Subscribe to Alerts</h3>
    <div class="api-endpoint">
      <span class="method post">POST</span>
      <code>/v1/subscribe</code>
    </div>
    <p>Create an alert subscription for an API. Supports email, Slack, Discord, PagerDuty, Teams, and webhook channels.</p>

    <h3>Report an Issue</h3>
    <div class="api-endpoint">
      <span class="method post">POST</span>
      <code>/v1/reports</code>
    </div>
    <p>Submit a manual issue report for an API to help the community.</p>

    <h3>SLA Report (Pro)</h3>
    <div class="api-endpoint">
      <span class="method get">GET</span>
      <code>/v1/reports/sla?api_slug=&#123;slug&#125;</code>
    </div>
    <p>Download an SLA compliance report in JSON format. Requires Pro tier.</p>
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

  <section id="troubleshooting">
    <h2>Troubleshooting</h2>

    <div class="faq-item">
      <h3>Signals not appearing in dashboard</h3>
      <p>Ensure your SDK key is correct and active. Check that <code>apidown.init()</code> is called before any HTTP requests. Enable <code>debug: true</code> in the config to see console output.</p>
    </div>

    <div class="faq-item">
      <h3>SDK conflicts with existing interceptors</h3>
      <p>APIdown patches <code>fetch</code>, <code>axios</code>, and <code>requests</code> at the module level. If you have custom interceptors, ensure APIdown is initialized first. Use the <code>allowlist</code> or <code>denylist</code> config to control which domains are monitored.</p>
    </div>

    <div class="faq-item">
      <h3>High signal volume / rate limiting</h3>
      <p>The SDK batches signals and respects rate limits automatically. Free tier allows 10,000 signals/day; Pro allows 100,000. Increase <code>flushInterval</code> or use <code>allowlist</code> to reduce volume.</p>
    </div>

    <div class="faq-item">
      <h3>SDK not initializing in serverless environments</h3>
      <p>In Lambda/Vercel/Cloudflare Workers, call <code>init()</code> outside the handler to avoid re-initialization on each invocation. Use the global guard pattern shown in the Next.js example above.</p>
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

  /* Breadcrumb */
  .breadcrumb { margin-bottom: 1rem; }
  .breadcrumb ol { list-style: none; padding: 0; margin: 0; display: flex; gap: 0.35rem; font-size: 0.8rem; color: var(--color-text-muted); }
  .breadcrumb li:not(:last-child)::after { content: '\203A'; margin-left: 0.35rem; }
  .breadcrumb a { color: var(--color-text-muted); text-decoration: none; }
  .breadcrumb a:hover { color: var(--color-primary); }

  /* Getting Started quickstart */
  .quickstart-steps {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }

  .qs-step {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    padding: 1rem 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
  }

  .qs-num {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--color-primary);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .qs-step strong {
    display: block;
    font-size: 0.9rem;
    margin-bottom: 0.2rem;
  }

  .qs-step p {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .qs-step code {
    background: var(--color-bg);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.8rem;
  }

  /* REST API Reference */
  .api-endpoint {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    margin-bottom: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  .method {
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .method.get { background: rgba(16, 185, 129, 0.15); color: #10b981; }
  .method.post { background: rgba(6, 182, 212, 0.15); color: #06b6d4; }

  /* FAQ/Troubleshooting items */
  .faq-item {
    border-bottom: 1px solid var(--color-border);
    padding: 1rem 0;
  }

  .faq-item:last-child { border-bottom: none; }

  .faq-item h3 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 0.4rem;
    margin-top: 0;
  }

  .faq-item p {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.6;
  }
</style>
