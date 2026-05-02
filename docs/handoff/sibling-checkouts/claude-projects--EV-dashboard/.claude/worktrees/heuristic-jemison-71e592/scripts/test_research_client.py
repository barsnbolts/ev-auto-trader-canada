#!/usr/bin/env python3
"""Unit tests for research_client — env loading + graceful no-key behavior."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import research_client as rc  # noqa: E402


class TestLoadEnvLocal(unittest.TestCase):
    def setUp(self):
        # Reset module state
        rc._env_loaded = False
        for k in ("EXA_API_KEY", "APIFY_API_TOKEN", "_TEST_RC_KEY"):
            os.environ.pop(k, None)

    def test_loads_kv_pairs(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_root = Path(tmp)
            (tmp_root / ".env.local").write_text(
                "_TEST_RC_KEY=hello\n# a comment\nEMPTY=\n", encoding="utf-8"
            )
            orig = rc.ROOT
            rc.ROOT = tmp_root
            try:
                rc.load_env_local()
                self.assertEqual(os.environ.get("_TEST_RC_KEY"), "hello")
            finally:
                rc.ROOT = orig

    def test_strips_quotes(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_root = Path(tmp)
            (tmp_root / ".env.local").write_text('_TEST_RC_KEY="quoted"\n', encoding="utf-8")
            orig = rc.ROOT
            rc.ROOT = tmp_root
            try:
                rc.load_env_local()
                self.assertEqual(os.environ.get("_TEST_RC_KEY"), "quoted")
            finally:
                rc.ROOT = orig

    def test_does_not_overwrite_existing(self):
        os.environ["_TEST_RC_KEY"] = "preset"
        with tempfile.TemporaryDirectory() as tmp:
            tmp_root = Path(tmp)
            (tmp_root / ".env.local").write_text("_TEST_RC_KEY=fromfile\n", encoding="utf-8")
            orig = rc.ROOT
            rc.ROOT = tmp_root
            try:
                rc.load_env_local()
                self.assertEqual(os.environ.get("_TEST_RC_KEY"), "preset")
            finally:
                rc.ROOT = orig


class TestClientFactories(unittest.TestCase):
    def setUp(self):
        rc._env_loaded = False
        for k in ("EXA_API_KEY", "APIFY_API_TOKEN"):
            os.environ.pop(k, None)

    def test_exa_returns_none_when_unset(self):
        with tempfile.TemporaryDirectory() as tmp:
            orig = rc.ROOT
            rc.ROOT = Path(tmp)
            try:
                self.assertIsNone(rc.ExaClient.from_env())
            finally:
                rc.ROOT = orig

    def test_apify_returns_none_when_unset(self):
        with tempfile.TemporaryDirectory() as tmp:
            orig = rc.ROOT
            rc.ROOT = Path(tmp)
            try:
                self.assertIsNone(rc.ApifyClient.from_env())
            finally:
                rc.ROOT = orig

    def test_exa_constructs_when_key_present(self):
        os.environ["EXA_API_KEY"] = "xx"
        c = rc.ExaClient.from_env()
        self.assertIsNotNone(c)
        self.assertEqual(c.api_key, "xx")

    def test_apify_constructs_when_token_present(self):
        os.environ["APIFY_API_TOKEN"] = "tt"
        c = rc.ApifyClient.from_env()
        self.assertIsNotNone(c)
        self.assertEqual(c.token, "tt")


if __name__ == "__main__":
    unittest.main()
