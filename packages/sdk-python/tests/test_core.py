"""Tests for apidown SDK core functionality."""

import json
import time
import unittest
from unittest.mock import patch, MagicMock

import apidown


class TestInit(unittest.TestCase):
    def setUp(self):
        apidown._config = None
        apidown._queue = []
        apidown._patched = False
        if apidown._flush_timer:
            apidown._flush_timer.cancel()
            apidown._flush_timer = None

    def tearDown(self):
        if apidown._flush_timer:
            apidown._flush_timer.cancel()
            apidown._flush_timer = None

    def test_init_sets_config(self):
        apidown.init(api_key="test-key", auto_patch=False)
        self.assertIsNotNone(apidown._config)
        self.assertEqual(apidown._config["api_key"], "test-key")

    def test_init_default_endpoint(self):
        apidown.init(auto_patch=False)
        self.assertEqual(apidown._config["endpoint"], "https://ingest.apidown.net/v1/signals")


class TestRecord(unittest.TestCase):
    def setUp(self):
        apidown._config = None
        apidown._queue = []
        apidown._patched = False
        if apidown._flush_timer:
            apidown._flush_timer.cancel()
            apidown._flush_timer = None

    def tearDown(self):
        if apidown._flush_timer:
            apidown._flush_timer.cancel()
            apidown._flush_timer = None

    def test_record_without_init_is_noop(self):
        apidown.record("api.example.com", 200, 50)
        self.assertEqual(len(apidown._queue), 0)

    def test_record_adds_to_queue(self):
        apidown.init(auto_patch=False)
        apidown.record("api.stripe.com", 200, 123.4)
        self.assertEqual(len(apidown._queue), 1)
        self.assertEqual(apidown._queue[0]["domain"], "api.stripe.com")
        self.assertEqual(apidown._queue[0]["status"], 200)
        self.assertEqual(apidown._queue[0]["duration"], 123.4)

    def test_record_with_region(self):
        apidown.init(auto_patch=False)
        apidown.record("api.stripe.com", 200, 50, region="us-east-1")
        self.assertEqual(apidown._queue[0]["region"], "us-east-1")


class TestShouldMonitor(unittest.TestCase):
    def setUp(self):
        apidown._config = None
        apidown._queue = []
        apidown._patched = False
        if apidown._flush_timer:
            apidown._flush_timer.cancel()
            apidown._flush_timer = None

    def tearDown(self):
        if apidown._flush_timer:
            apidown._flush_timer.cancel()
            apidown._flush_timer = None

    def test_no_config_returns_false(self):
        self.assertFalse(apidown._should_monitor("https://api.stripe.com"))

    def test_self_monitor_blocked(self):
        apidown.init(auto_patch=False)
        self.assertFalse(apidown._should_monitor("https://ingest.apidown.net/v1/signals"))

    def test_allowlist_filters(self):
        apidown.init(allowlist=["api.stripe.com"], auto_patch=False)
        self.assertTrue(apidown._should_monitor("https://api.stripe.com/v1/charges"))
        self.assertFalse(apidown._should_monitor("https://api.github.com/repos"))

    def test_denylist_filters(self):
        apidown.init(denylist=["internal.example.com"], auto_patch=False)
        self.assertTrue(apidown._should_monitor("https://api.stripe.com/v1"))
        self.assertFalse(apidown._should_monitor("https://internal.example.com/health"))

    def test_default_allows_all(self):
        apidown.init(auto_patch=False)
        self.assertTrue(apidown._should_monitor("https://api.stripe.com/v1"))


class TestFlush(unittest.TestCase):
    def setUp(self):
        apidown._config = None
        apidown._queue = []
        apidown._patched = False
        if apidown._flush_timer:
            apidown._flush_timer.cancel()
            apidown._flush_timer = None

    def tearDown(self):
        if apidown._flush_timer:
            apidown._flush_timer.cancel()
            apidown._flush_timer = None

    @patch("apidown.urlopen")
    def test_flush_sends_batch(self, mock_urlopen):
        apidown.init(auto_patch=False)
        apidown.record("api.stripe.com", 200, 50)
        apidown.record("api.github.com", 500, 100)
        apidown.flush()

        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data.decode("utf-8"))
        self.assertEqual(len(body["signals"]), 2)
        self.assertEqual(len(apidown._queue), 0)

    @patch("apidown.urlopen")
    def test_flush_empty_is_noop(self, mock_urlopen):
        apidown.init(auto_patch=False)
        apidown.flush()
        mock_urlopen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
