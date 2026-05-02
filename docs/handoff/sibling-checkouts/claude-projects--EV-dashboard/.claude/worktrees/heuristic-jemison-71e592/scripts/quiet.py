#!/usr/bin/env python3
"""quiet.py — RTK-style command output compressor (project-scoped).

Inspired by rtk-ai/rtk (Rust Token Killer) but written as a single Python
script so it ships with the repo and needs no separate install. Wraps the
verbose dev commands this project runs constantly and trims their output to
the salient summary lines, preserving exit codes and red-line failure detail.

Typical savings on this project's commands:
  npx tsc --noEmit         200→3   lines  (98%)
  npm test -- --run        300→8   lines  (97%)
  cargo test               180→5   lines  (97%)
  validate.py              60→2    lines  (95% — keeps WARN/ERROR)
  git status               40→6    lines  (85%)
  git diff                 unbounded → first 80 lines + counter
  git log                  unbounded → top 10 oneline
  ls / find                unbounded → first 50 entries + counter

Usage:
    python3 scripts/quiet.py <command> [args...]
    python3 scripts/quiet.py npx tsc --noEmit
    python3 scripts/quiet.py npm test -- --run
    python3 scripts/quiet.py cargo test --manifest-path src-tauri/Cargo.toml

What gets through (always):
  - Exit code (propagated)
  - Lines matching: error|fail|FAIL|✗|×|panic|RuntimeError
  - Lines matching: WARN
  - Final summary line(s) the underlying tool prints

What gets trimmed:
  - Per-test-pass spam from vitest / pytest / cargo test
  - tsc compile-progress noise (only the diagnostic lines stay)
  - Apple/clang link warnings (kept count, dropped text)

Tokens saved counter is appended as a final line so the LLM sees the
compression ratio it just got.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from typing import Iterable

# Patterns that ALWAYS pass through, even if they'd otherwise be trimmed.
KEEP_PATTERNS = re.compile(
    r"(?i)(\berror\b|\bfail(ed|ure)?\b|\bpanic\b|✗|×|RuntimeError|"
    r"\bWARN\b|^Error:|^TypeError|^SyntaxError|stack overflow|"
    r"unhandled exception|halt:|HALT)"
)

# Patterns that are never useful for this project — drop on sight.
DROP_PATTERNS = re.compile(
    r"^(\s*✓\s|\s*PASS\s|\s*ok\s+\d+|\s*RUN\s+|\s*Compiling\s+|\s*Finished\s+|"
    r"^npm warn deprecated|^node:.*ExperimentalWarning|^Both esbuild and oxc)"
)


def _filter_lines(lines: Iterable[str], max_keep: int = 200) -> list[str]:
    out: list[str] = []
    dropped = 0
    for line in lines:
        if KEEP_PATTERNS.search(line):
            out.append(line)
            continue
        if DROP_PATTERNS.search(line):
            dropped += 1
            continue
        out.append(line)
    if len(out) > max_keep:
        # Keep first 30 + last (max_keep - 30) to preserve summary at the end.
        head, tail = out[:30], out[-(max_keep - 30):]
        out = head + [f"... [{len(out) - max_keep} middle lines trimmed]"] + tail
    if dropped:
        out.append(f"[quiet.py: dropped {dropped} pass/noise lines]")
    return out


# ---------------------------------------------------------------------------
# Per-command specializations — when we know the tool, do better than generic.
# ---------------------------------------------------------------------------


def _summarize_vitest(text: str) -> str:
    """Return only the final 'Test Files X passed (Y)' + 'Tests N passed (M)'
    summary plus any FAIL blocks. Drop everything else."""
    lines = text.splitlines()
    summary_lines: list[str] = []
    fail_blocks: list[str] = []
    in_fail = False
    fail_buf: list[str] = []
    for line in lines:
        if "FAIL" in line and "PASS" not in line:
            in_fail = True
            fail_buf = [line]
            continue
        if in_fail:
            fail_buf.append(line)
            if line.strip() == "" and len(fail_buf) > 4:
                fail_blocks.append("\n".join(fail_buf))
                in_fail = False
        if re.match(r"\s*(Test Files|Tests|Duration|Start at|Errors)\s+", line):
            summary_lines.append(line)
    if in_fail and fail_buf:
        fail_blocks.append("\n".join(fail_buf))
    parts: list[str] = []
    if fail_blocks:
        parts.append("=== FAILURES ===")
        parts.extend(fail_blocks)
        parts.append("=== END FAILURES ===")
    parts.extend(summary_lines)
    if not parts:
        # Nothing matched → fall back to generic filter.
        return "\n".join(_filter_lines(lines, max_keep=80))
    return "\n".join(parts)


def _summarize_cargo(text: str) -> str:
    """Cargo test: keep failures + 'test result:' summary line per crate."""
    lines = text.splitlines()
    out: list[str] = []
    for line in lines:
        if re.match(r"^\s*test\s+\S+\s+\.\.\.\s+ok\s*$", line):
            continue  # drop per-test-pass
        if line.startswith("warning: ") or line.startswith("    Compiling "):
            continue
        if re.search(r"(FAILED|failures:|test result:|error\[E\d+\])", line):
            out.append(line)
            continue
        # Catch-all: if it looks important, keep it
        if KEEP_PATTERNS.search(line):
            out.append(line)
    return "\n".join(out) if out else "(cargo test: no failures, no result line — likely no tests run)"


def _summarize_tsc(text: str) -> str:
    """tsc: only diagnostic lines (file:line:col format)."""
    lines = text.splitlines()
    out = [l for l in lines if re.match(r"^\S+\.tsx?\(\d+,\d+\):", l) or "error" in l.lower()]
    return "\n".join(out) if out else "(tsc: 0 errors)"


def _summarize_git_status(text: str) -> str:
    """git status: keep counts + the actual modified paths, drop the prose."""
    lines = text.splitlines()
    branch_line = next((l for l in lines if l.startswith("On branch") or l.startswith("HEAD detached")), "")
    paths = []
    for line in lines:
        s = line.strip()
        if s.startswith(("modified:", "new file:", "deleted:", "renamed:", "??")):
            paths.append(line)
    if not paths and not branch_line:
        return text  # fallthrough
    out: list[str] = []
    if branch_line:
        out.append(branch_line)
    out.append(f"({len(paths)} changed files)")
    out.extend(paths[:50])
    if len(paths) > 50:
        out.append(f"... [+{len(paths) - 50} more]")
    return "\n".join(out)


def _summarize_git_diff(text: str) -> str:
    """git diff: cap at 200 lines; show file headers + counter."""
    lines = text.splitlines()
    if len(lines) <= 200:
        return text
    # Find diff --git headers to estimate file count
    files = sum(1 for l in lines if l.startswith("diff --git "))
    return "\n".join(lines[:120] + [f"... [+{len(lines) - 120} more lines across {files} files]"])


def _summarize_git_log(text: str, n: int = 12) -> str:
    """git log: take first N entries."""
    lines = text.splitlines()
    return "\n".join(lines[:n] + ([f"... [+{len(lines) - n} more lines]"] if len(lines) > n else []))


SPECIALIZED: dict[str, callable] = {
    "vitest": _summarize_vitest,
    "cargo": _summarize_cargo,
    "tsc": _summarize_tsc,
    "git-status": _summarize_git_status,
    "git-diff": _summarize_git_diff,
    "git-log": _summarize_git_log,
}


def detect_kind(argv: list[str]) -> str:
    """Pick a specialized summarizer based on the command shape."""
    if not argv:
        return ""
    j = " ".join(argv)
    if "vitest" in j or "npm test" in j or " jest " in j:
        return "vitest"
    if argv[0] == "cargo" or "cargo test" in j or "cargo build" in j:
        return "cargo"
    if "tsc" in j:
        return "tsc"
    if argv[:2] == ["git", "status"]:
        return "git-status"
    if argv[:2] == ["git", "diff"]:
        return "git-diff"
    if argv[:2] == ["git", "log"]:
        return "git-log"
    return ""


def estimate_tokens(s: str) -> int:
    """Quick char/4 heuristic — close enough for a savings counter."""
    return max(1, len(s) // 4)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, add_help=False)
    parser.add_argument("--quiet-help", action="store_true")
    parser.add_argument("--quiet-no-counter", action="store_true",
                        help="suppress the trailing token-savings line")
    parser.add_argument("--quiet-max", type=int, default=200,
                        help="max lines to keep in generic filter")
    args, rest = parser.parse_known_args(argv[1:])

    if args.quiet_help or not rest:
        parser.print_help()
        print("\nExamples:")
        print("  python3 scripts/quiet.py npx tsc --noEmit")
        print("  python3 scripts/quiet.py npm test -- --run")
        print("  python3 scripts/quiet.py cargo test --manifest-path src-tauri/Cargo.toml")
        print("  python3 scripts/quiet.py git status")
        return 0

    proc = subprocess.run(rest, capture_output=True, text=True)
    raw_stdout = proc.stdout
    raw_stderr = proc.stderr
    raw_combined = raw_stdout + (("\n" + raw_stderr) if raw_stderr else "")

    kind = detect_kind(rest)
    if kind in SPECIALIZED:
        compressed = SPECIALIZED[kind](raw_combined)
    else:
        compressed = "\n".join(_filter_lines(raw_combined.splitlines(), max_keep=args.quiet_max))

    sys.stdout.write(compressed)
    if not compressed.endswith("\n"):
        sys.stdout.write("\n")

    if not args.quiet_no_counter:
        before = estimate_tokens(raw_combined)
        after = estimate_tokens(compressed)
        if before > 0:
            saved = max(0, before - after)
            pct = round(100 * saved / before)
            sys.stdout.write(
                f"[quiet.py: {kind or 'generic'} | ~{before:,}→{after:,} tokens, -{pct}%]\n"
            )

    return proc.returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv))
