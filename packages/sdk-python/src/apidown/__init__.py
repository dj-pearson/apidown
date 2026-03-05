"""
apidown - Lightweight passive API health signal collector.
Zero external dependencies. Auto-patches requests and httpx.
"""

import atexit
import json
import threading
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError

__version__ = "1.0.0"

_DEFAULT_ENDPOINT = "https://ingest.apidown.net/v1/signals"
_DEFAULT_FLUSH_INTERVAL = 30
_DEFAULT_MAX_BATCH = 100

_config = None
_queue = []
_lock = threading.Lock()
_flush_timer = None
_patched = False


def init(
    api_key=None,
    endpoint=None,
    flush_interval=None,
    max_batch_size=None,
    allowlist=None,
    denylist=None,
    debug=False,
    auto_patch=True,
):
    """Initialize the apidown monitor.

    Args:
        api_key: Your API key (optional during beta).
        endpoint: Signal ingest endpoint URL.
        flush_interval: Seconds between flushes (default 30).
        max_batch_size: Max signals per flush (default 100).
        allowlist: List of domains to monitor (exclusive).
        denylist: List of domains to skip.
        debug: Print debug messages to stderr.
        auto_patch: Whether to auto-patch requests/httpx (default True).
    """
    global _config
    _config = {
        "api_key": api_key,
        "endpoint": endpoint or _DEFAULT_ENDPOINT,
        "flush_interval": flush_interval or _DEFAULT_FLUSH_INTERVAL,
        "max_batch_size": max_batch_size or _DEFAULT_MAX_BATCH,
        "allowlist": allowlist or [],
        "denylist": denylist or [],
        "debug": debug,
    }

    if auto_patch:
        _auto_patch()

    _schedule_flush()
    atexit.register(shutdown)

    if debug:
        import sys
        print("[apidown] initialized", file=sys.stderr)


def record(domain, status_code, duration_ms, region=None):
    """Manually record a signal.

    Args:
        domain: The API domain (e.g. "api.stripe.com").
        status_code: HTTP status code (0 for network error).
        duration_ms: Request duration in milliseconds.
        region: Optional region identifier.
    """
    if _config is None:
        return
    signal = {
        "domain": domain,
        "status": int(status_code),
        "duration": round(duration_ms, 1),
        "ts": int(time.time() * 1000),
    }
    if region:
        signal["region"] = region
    with _lock:
        _queue.append(signal)
        if len(_queue) >= _config["max_batch_size"]:
            _do_flush()


def flush():
    """Force an immediate flush of queued signals."""
    with _lock:
        _do_flush()


def shutdown():
    """Flush remaining signals and stop the timer."""
    global _flush_timer
    if _flush_timer:
        _flush_timer.cancel()
        _flush_timer = None
    flush()
    if _config and _config["debug"]:
        import sys
        print("[apidown] shutdown complete", file=sys.stderr)


def _should_monitor(url):
    """Check if a URL should be monitored based on allow/deny lists."""
    if _config is None:
        return False
    try:
        hostname = urlparse(url).hostname or ""
    except Exception:
        return False

    # Never self-monitor
    try:
        ingest_host = urlparse(_config["endpoint"]).hostname
        if hostname == ingest_host:
            return False
    except Exception:
        pass

    if _config["allowlist"]:
        return any(hostname.endswith(d) for d in _config["allowlist"])

    if _config["denylist"]:
        if any(hostname.endswith(d) for d in _config["denylist"]):
            return False

    return True


def _do_flush():
    """Internal flush (must hold _lock)."""
    if not _config or not _queue:
        return
    batch = _queue[:_config["max_batch_size"]]
    del _queue[:len(batch)]

    if _config["debug"]:
        import sys
        print(f"[apidown] flushing {len(batch)} signals", file=sys.stderr)

    payload = json.dumps({
        "signals": batch,
        **({"api_key": _config["api_key"]} if _config["api_key"] else {}),
    }).encode("utf-8")

    try:
        req = Request(
            _config["endpoint"],
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urlopen(req, timeout=5)
    except (URLError, OSError):
        # Silently drop — never crash the host app
        pass


def _schedule_flush():
    """Schedule the next periodic flush."""
    global _flush_timer
    if _config is None:
        return
    _flush_timer = threading.Timer(_config["flush_interval"], _timer_flush)
    _flush_timer.daemon = True
    _flush_timer.start()


def _timer_flush():
    """Timer callback: flush then reschedule."""
    flush()
    _schedule_flush()


def _auto_patch():
    """Auto-patch requests and httpx if installed."""
    global _patched
    if _patched:
        return
    _patched = True

    # Patch requests
    try:
        import requests as _requests

        _orig_send = _requests.Session.send

        def _patched_send(self, prepared, **kwargs):
            url = prepared.url or ""
            if not _should_monitor(url):
                return _orig_send(self, prepared, **kwargs)

            start = time.monotonic()
            try:
                resp = _orig_send(self, prepared, **kwargs)
                duration = (time.monotonic() - start) * 1000
                domain = urlparse(url).hostname or ""
                record(domain, resp.status_code, duration)
                return resp
            except Exception:
                duration = (time.monotonic() - start) * 1000
                domain = urlparse(url).hostname or ""
                record(domain, 0, duration)
                raise

        _requests.Session.send = _patched_send
    except ImportError:
        pass

    # Patch httpx
    try:
        import httpx as _httpx

        _orig_httpx_send = _httpx.Client.send

        def _patched_httpx_send(self, request, **kwargs):
            url = str(request.url)
            if not _should_monitor(url):
                return _orig_httpx_send(self, request, **kwargs)

            start = time.monotonic()
            try:
                resp = _orig_httpx_send(self, request, **kwargs)
                duration = (time.monotonic() - start) * 1000
                domain = urlparse(url).hostname or ""
                record(domain, resp.status_code, duration)
                return resp
            except Exception:
                duration = (time.monotonic() - start) * 1000
                domain = urlparse(url).hostname or ""
                record(domain, 0, duration)
                raise

        _httpx.Client.send = _patched_httpx_send
    except ImportError:
        pass
