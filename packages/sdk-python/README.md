# apidown

Lightweight passive API health signal collector for [APIdown.net](https://apidown.net).

Zero external dependencies. Auto-patches `requests` and `httpx`.

## Install

```bash
pip install apidown
```

## Quick Start

```python
import apidown

apidown.init(api_key="your-key")

# That's it! HTTP calls via requests/httpx are automatically monitored.
```

## Manual Recording

```python
apidown.record("api.stripe.com", 200, 123.4)
```

## Configuration

```python
apidown.init(
    api_key="your-key",
    endpoint="https://ingest.apidown.net/v1/signals",
    flush_interval=30,        # seconds
    max_batch_size=100,
    allowlist=["api.stripe.com"],  # only monitor these
    denylist=["internal.api.com"], # skip these
    debug=True,
)
```
