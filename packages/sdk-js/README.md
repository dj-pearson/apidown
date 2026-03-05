# apidown-monitor

Lightweight passive API health signal collector for [APIdown.net](https://apidown.net).

**Zero dependencies** | Node.js 16+ | Browser compatible

## Installation

```bash
npm install apidown-monitor
# or
yarn add apidown-monitor
# or
pnpm add apidown-monitor
```

## Quick Start

```javascript
// CommonJS
const apidown = require('apidown-monitor');

// ESM
import apidown from 'apidown-monitor';

// Initialize once at app startup (before any API calls)
apidown.init({ key: 'YOUR_SDK_KEY' });

// That's it! All fetch() and axios calls are now automatically monitored.
```

## Configuration

```javascript
apidown.init({
  key: 'YOUR_SDK_KEY',           // Required
  endpoint: 'https://ingest.apidown.net/v1/signals', // Optional
  flushInterval: 30000,          // ms between sends (default: 30s)
  maxBatchSize: 100,             // max signals per batch
  allowlist: ['api.stripe.com'], // only monitor these domains
  denylist: ['internal-api.co'], // never monitor these domains
  debug: false,                  // console logging
});
```

## Framework Examples

### Express / Node.js
```javascript
const apidown = require('apidown-monitor');
apidown.init({ key: process.env.APIDOWN_KEY });

// All axios and fetch calls are automatically monitored
```

### Next.js
```javascript
// lib/apidown.js
import apidown from 'apidown-monitor';

if (typeof window === 'undefined') {
  if (!global._apidownInit) {
    apidown.init({ key: process.env.APIDOWN_KEY });
    global._apidownInit = true;
  }
}
```

### SvelteKit
```javascript
// src/hooks.server.js
import apidown from 'apidown-monitor';
apidown.init({ key: import.meta.env.APIDOWN_KEY });
```

## Manual Recording

For custom HTTP clients not auto-patched:

```javascript
const start = Date.now();
try {
  const res = await myClient.get('https://api.stripe.com/v1/charges');
  apidown.record('api.stripe.com', res.statusCode, Date.now() - start);
} catch (e) {
  apidown.record('api.stripe.com', 0, Date.now() - start);
  throw e;
}
```

## Privacy

APIdown **never** captures request payloads, headers, authentication tokens, or any user data. Only domain, HTTP status code, response duration (ms), and timestamp are transmitted.

## License

MIT
