#!/usr/bin/env python3
"""Unit tests for quiet.py specializations."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from quiet import (  # noqa: E402
    _summarize_vitest,
    _summarize_cargo,
    _summarize_tsc,
    _summarize_git_status,
    _summarize_git_log,
    detect_kind,
    estimate_tokens,
)


class TestVitest(unittest.TestCase):
    def test_keeps_summary_lines_drops_pass_lines(self):
        text = """
RUN  v4.1.5 /repo
✓ src/foo.test.ts > foo > does X
✓ src/foo.test.ts > foo > does Y
✓ src/foo.test.ts > foo > does Z
PASS  src/foo.test.ts
Test Files  3 passed (3)
Tests  19 passed (19)
Duration  1.5s
"""
        out = _summarize_vitest(text)
        self.assertIn("Test Files  3 passed (3)", out)
        self.assertIn("Tests  19 passed (19)", out)
        # Per-test pass lines dropped
        self.assertNotIn("does X", out)

    def test_preserves_failure_blocks(self):
        text = """
FAIL  src/foo.test.ts > foo > does X
  AssertionError: expected 1 to be 2
  at foo.test.ts:12

Test Files  1 failed (1)
Tests  1 failed (1)
"""
        out = _summarize_vitest(text)
        self.assertIn("FAIL", out)
        self.assertIn("AssertionError", out)
        self.assertIn("Test Files  1 failed (1)", out)


class TestCargo(unittest.TestCase):
    def test_drops_per_test_pass(self):
        text = """\
   Compiling foo v0.1.0
    Finished test [unoptimized + debuginfo] target(s) in 0.5s
     Running unittests src/lib.rs
test foo::tests::a ... ok
test foo::tests::b ... ok
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
"""
        out = _summarize_cargo(text)
        self.assertIn("test result:", out)
        self.assertNotIn("foo::tests::a ... ok", out)


class TestTsc(unittest.TestCase):
    def test_no_errors_message_when_empty(self):
        self.assertEqual(_summarize_tsc(""), "(tsc: 0 errors)")

    def test_keeps_diagnostics(self):
        text = "src/foo.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.\n"
        out = _summarize_tsc(text)
        self.assertIn("src/foo.ts(10,5)", out)


class TestGit(unittest.TestCase):
    def test_status_keeps_branch_and_paths(self):
        text = """\
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
        modified:   src/a.ts
        modified:   src/b.ts

Untracked files:
        ?? src/new.ts
"""
        out = _summarize_git_status(text)
        self.assertIn("On branch main", out)
        self.assertIn("modified:   src/a.ts", out)
        self.assertIn("(3 changed files)", out)
        # Drops the prose
        self.assertNotIn("use \"git add", out)

    def test_log_caps_to_n_lines(self):
        text = "\n".join(f"hash{i} commit msg {i}" for i in range(50))
        out = _summarize_git_log(text, n=5)
        lines = out.splitlines()
        self.assertEqual(len(lines), 6)  # 5 lines + counter
        self.assertIn("more lines", lines[-1])


class TestDetect(unittest.TestCase):
    def test_detects_vitest(self):
        self.assertEqual(detect_kind(["npm", "test", "--", "--run"]), "vitest")
        self.assertEqual(detect_kind(["npx", "vitest", "run"]), "vitest")

    def test_detects_cargo(self):
        self.assertEqual(detect_kind(["cargo", "test"]), "cargo")
        self.assertEqual(detect_kind(["cargo", "build", "--release"]), "cargo")

    def test_detects_tsc(self):
        self.assertEqual(detect_kind(["npx", "tsc", "--noEmit"]), "tsc")

    def test_detects_git_subcommands(self):
        self.assertEqual(detect_kind(["git", "status"]), "git-status")
        self.assertEqual(detect_kind(["git", "diff"]), "git-diff")
        self.assertEqual(detect_kind(["git", "log", "--oneline"]), "git-log")

    def test_unknown_returns_empty(self):
        self.assertEqual(detect_kind(["echo", "hi"]), "")


class TestTokenEstimate(unittest.TestCase):
    def test_minimum_one(self):
        self.assertEqual(estimate_tokens(""), 1)

    def test_chars_over_4(self):
        self.assertEqual(estimate_tokens("x" * 100), 25)


if __name__ == "__main__":
    unittest.main()
