/**
 * apidown-monitor
 * Lightweight passive API health signal collector
 * Zero dependencies | Node.js 16+ | Browser compatible
 */

'use strict';

const DEFAULT_ENDPOINT = 'https://ingest.apidown.net/v1/signals';
const DEFAULT_FLUSH_INTERVAL = 30000;
const DEFAULT_MAX_BATCH = 100;

let _config = null;
let _queue = [];
let _flushTimer = null;
let _originalFetch = null;

function shouldMonitor(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  // Never self-monitor
  try {
    if (hostname === new URL(_config.endpoint).hostname) return false;
  } catch {
    return false;
  }
  if (_config.allowlist && _config.allowlist.length > 0) {
    return _config.allowlist.some(d => hostname.endsWith(d));
  }
  if (_config.denylist && _config.denylist.length > 0) {
    if (_config.denylist.some(d => hostname.endsWith(d))) return false;
  }
  return true;
}

function addSignal(domain, status, duration) {
  if (!_config) return;
  _queue.push({ domain, status, duration, ts: Date.now() });
  if (_queue.length >= _config.maxBatchSize) flush();
}

async function flush() {
  if (!_config || _queue.length === 0) return;
  const batch = _queue.splice(0, _config.maxBatchSize);
  if (_config.debug) console.log('[apidown] flushing', batch.length, 'signals');

  const sendFn = _originalFetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!sendFn) {
    if (_config.debug) console.warn('[apidown] no fetch available, discarding batch');
    return;
  }

  try {
    await sendFn(_config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APIdown-Key': _config.key,
      },
      body: JSON.stringify({ signals: batch }),
      keepalive: true,
    });
  } catch (e) {
    if (_config.debug) console.warn('[apidown] flush failed:', e.message);
    // Silently discard — never block application flow
  }
}

function patchFetch() {
  if (typeof globalThis === 'undefined') return;
  if (typeof globalThis.fetch === 'undefined') return;
  _originalFetch = globalThis.fetch;

  const monitoredFetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return _originalFetch(input, init);
    }

    if (!shouldMonitor(url)) return _originalFetch(input, init);

    const start = Date.now();
    try {
      const res = await _originalFetch(input, init);
      addSignal(hostname, res.status, Date.now() - start);
      return res;
    } catch (e) {
      addSignal(hostname, 0, Date.now() - start); // 0 = network error
      throw e;
    }
  };

  Object.keys(globalThis.fetch).forEach(key => {
    monitoredFetch[key] = globalThis.fetch[key];
  });
  globalThis.fetch = monitoredFetch;
}

function patchAxios() {
  try {
    const axios = require('axios');
    axios.interceptors.request.use(config => {
      config._apidown_start = Date.now();
      return config;
    });
    axios.interceptors.response.use(
      response => {
        const url = response.config && response.config.url ? response.config.url : '';
        let hostname;
        try {
          hostname = new URL(url, response.config && response.config.baseURL).hostname;
        } catch {
          return response;
        }
        if (shouldMonitor(url)) {
          addSignal(hostname, response.status, Date.now() - (response.config._apidown_start || Date.now()));
        }
        return response;
      },
      error => {
        const url = error.config && error.config.url ? error.config.url : '';
        let hostname;
        try {
          hostname = new URL(url, error.config && error.config.baseURL).hostname;
        } catch {
          return Promise.reject(error);
        }
        if (shouldMonitor(url)) {
          const status = error.response ? error.response.status : 0;
          addSignal(hostname, status, Date.now() - (error.config && error.config._apidown_start ? error.config._apidown_start : Date.now()));
        }
        return Promise.reject(error);
      }
    );
  } catch {
    /* axios not installed — skip */
  }
}

const apidown = {
  init(config) {
    if (!config || !config.key) throw new Error('[apidown] key is required');
    _config = {
      key: config.key,
      endpoint: config.endpoint || DEFAULT_ENDPOINT,
      flushInterval: config.flushInterval || DEFAULT_FLUSH_INTERVAL,
      maxBatchSize: config.maxBatchSize || DEFAULT_MAX_BATCH,
      allowlist: config.allowlist || [],
      denylist: config.denylist || [],
      debug: config.debug || false,
    };

    patchFetch();
    patchAxios();
    _flushTimer = setInterval(flush, _config.flushInterval);

    // Flush on process exit (Node.js)
    if (typeof process !== 'undefined' && process.on) {
      process.on('beforeExit', flush);
    }

    if (_config.debug) console.log('[apidown] initialized');
  },

  shutdown() {
    if (_flushTimer) clearInterval(_flushTimer);
    flush();
    if (_originalFetch && typeof globalThis !== 'undefined') {
      globalThis.fetch = _originalFetch;
    }
    _config = null;
    _queue = [];
  },

  // Manual signal — for frameworks with custom HTTP clients
  record(domain, statusCode, durationMs) {
    if (!_config) return;
    if (shouldMonitor('https://' + domain)) {
      addSignal(domain, statusCode, durationMs);
    }
  },
};

module.exports = apidown;
module.exports.default = apidown;
