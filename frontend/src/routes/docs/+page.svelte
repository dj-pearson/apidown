<svelte:head>
  <title>SDK Documentation — APIdown.net</title>
  <meta name="description" content="Integrate the APIdown SDK into your application to contribute real-time API health signals." />
</svelte:head>

<article class="docs">
  <h1>SDK Integration Guide</h1>
  <p class="lead">Start contributing real-time API health signals with a single line of code.</p>

  <section>
    <h2>JavaScript / Node.js</h2>

    <h3>Install</h3>
    <pre><code>npm install apidown-monitor</code></pre>

    <h3>Initialize</h3>
    <pre><code>{"import apidown from 'apidown-monitor';\n\napidown.init({ key: 'YOUR_SDK_KEY' });\n\n// That's it — all fetch() and axios calls are automatically monitored."}</code></pre>

    <h3>Express / Node.js</h3>
    <pre><code>{"const apidown = require('apidown-monitor');\napidown.init({ key: process.env.APIDOWN_KEY });\n\nconst express = require('express');\nconst app = express();\n\n// All outbound API calls are now monitored"}</code></pre>

    <h3>Next.js</h3>
    <pre><code>{"// lib/apidown.js\nimport apidown from 'apidown-monitor';\n\nif (typeof window === 'undefined') {\n  if (!global._apidownInit) {\n    apidown.init({ key: process.env.APIDOWN_KEY });\n    global._apidownInit = true;\n  }\n}"}</code></pre>

    <h3>SvelteKit</h3>
    <pre><code>{"// src/hooks.server.js\nimport apidown from 'apidown-monitor';\napidown.init({ key: import.meta.env.APIDOWN_KEY });"}</code></pre>
  </section>

  <section>
    <h2>Python</h2>

    <h3>Install</h3>
    <pre><code>pip install apidown</code></pre>

    <h3>Initialize</h3>
    <pre><code>{"import apidown\n\napidown.init(key='YOUR_SDK_KEY')\n\n# All requests and httpx calls are automatically monitored."}</code></pre>

    <h3>Django</h3>
    <pre><code>{"# manage.py or wsgi.py\nimport apidown, os\napidown.init(key=os.environ['APIDOWN_KEY'])\n\n# All requests library calls automatically reported"}</code></pre>

    <h3>FastAPI</h3>
    <pre><code>{"import apidown, os\napidown.init(key=os.environ['APIDOWN_KEY'])\n\nfrom fastapi import FastAPI\nimport httpx\n\napp = FastAPI()\n\n# httpx.Client is auto-patched"}</code></pre>
  </section>

  <section>
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

  <section>
    <h2>Privacy</h2>
    <p>APIdown <strong>never</strong> captures request payloads, headers, authentication tokens, or any user data. Only domain, HTTP status code, response duration (ms), and timestamp are transmitted. All data is anonymized at the SDK level before transmission.</p>
  </section>

  <section>
    <h2>Manual Recording</h2>
    <p>For custom HTTP clients not auto-patched by the SDK:</p>

    <pre><code>{"// JavaScript\nconst start = Date.now();\ntry {\n  const res = await myClient.get('https://api.stripe.com/v1/charges');\n  apidown.record('api.stripe.com', res.statusCode, Date.now() - start);\n} catch (e) {\n  apidown.record('api.stripe.com', 0, Date.now() - start);\n  throw e;\n}"}</code></pre>

    <pre><code>{"# Python\nimport apidown, time\nstart = time.time()\ntry:\n    resp = await session.get('https://api.stripe.com/v1/charges')\n    apidown.record('api.stripe.com', resp.status, int((time.time()-start)*1000))\nexcept Exception:\n    apidown.record('api.stripe.com', 0, int((time.time()-start)*1000))\n    raise"}</code></pre>
  </section>
</article>

<style>
  .docs {
    max-width: 800px;
    margin: 0 auto;
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

  pre {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
    overflow-x: auto;
    font-size: 0.85rem;
    line-height: 1.5;
    margin-bottom: 1rem;
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
