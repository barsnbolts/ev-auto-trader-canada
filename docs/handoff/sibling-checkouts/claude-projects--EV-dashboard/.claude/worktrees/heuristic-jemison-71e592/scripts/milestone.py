#!/usr/bin/env python3
"""
Milestone ritual runner. The gate every milestone passes through.

Expanded post-Cluster-A (A2). Now runs the full safety pipeline:

    tsc --noEmit                    # type check
    npm test -- --run               # Vitest suite
    scripts/validate.py             # seed integrity
    scripts/metrics.py              # regenerate PHASE_METRICS.md
    git add -A && git commit -m …   # save point
    append to LEARNINGS.md          # dated mechanical entry
    touch SESSION_SUMMARY timestamp
    scripts/queue.py                # re-rank + update .queue_top3.md
    (every 5th milestone)           # scripts/self_audit.py --append

Red halts. Exit 0 = milestone accepted. Non-zero = fix and rerun.

Usage:
    python3 scripts/milestone.py <id> "<caveman summary>"
    python3 scripts/milestone.py <id> "<summary>" --skip-git   # for dry-runs
"""

from __future__ import annotations

import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEARNINGS = ROOT / "LEARNINGS.md"
SUMMARY = ROOT / "SESSION_SUMMARY.md"


def run(cmd: list[str], label: str) -> int:
    print(f"  → {label}: {' '.join(cmd)}")
    return subprocess.call(cmd, cwd=ROOT)


def step(n: int, total: int, name: str) -> None:
    print(f"\n[{n}/{total}] {name}")


def _quiet(cmd: list[str], label: str) -> int:
    """Run a verbose command through scripts/quiet.py to compress its output."""
    wrapped = [sys.executable, str(ROOT / "scripts" / "quiet.py")] + cmd
    return run(wrapped, label)


def run_typecheck() -> int:
    return _quiet(["npx", "tsc", "--noEmit", "--pretty", "false"], "tsc (quiet)")


def run_tests() -> int:
    return _quiet(["npm", "test", "--silent", "--", "--run"], "vitest (quiet)")


def run_cargo_tests() -> int:
    return _quiet(
        ["cargo", "test", "--manifest-path", str(ROOT / "src-tauri" / "Cargo.toml")],
        "cargo test (quiet)",
    )


def run_validate() -> int:
    return run([sys.executable, str(ROOT / "scripts" / "validate.py")], "validate.py")


def run_recommend_model() -> int:
    """Run recommender silently (only nudges to stdout); always logs."""
    return run(
        [
            sys.executable,
            str(ROOT / "scripts" / "recommend_model.py"),
            "--append-log",
        ],
        "recommend_model --append-log",
    )


def run_drive_app_smoke() -> int:
    """Smoke-run drive_app against the fresh_load scenario. In --smoke mode,
    absence of a debug log is not a failure (fresh checkout before anyone ran
    the app with VITE_DEBUG=1). If a log exists, asserts no error events.
    """
    return run(
        [
            sys.executable,
            str(ROOT / "scripts" / "drive_app.py"),
            "--scenario",
            "fresh_load",
            "--smoke",
        ],
        "drive_app --smoke fresh_load",
    )


def run_metrics() -> int:
    return run([sys.executable, str(ROOT / "scripts" / "metrics.py")], "metrics.py")


def run_queue() -> int:
    return run([sys.executable, str(ROOT / "scripts" / "queue.py")], "queue.py")


def count_completed_milestones() -> int:
    if not LEARNINGS.exists():
        return 0
    text = LEARNINGS.read_text(encoding="utf-8")
    return len(re.findall(r"## \d{4}-\d{2}-\d{2} · Milestone ", text))


def run_self_audit_if_due() -> int:
    n = count_completed_milestones() + 1  # including the one about to be appended
    if n % 5 == 0:
        print(f"  → 5-milestone boundary hit (#{n}). Running self_audit.py …")
        return run(
            [sys.executable, str(ROOT / "scripts" / "self_audit.py"), "--append"],
            "self_audit.py",
        )
    return 0


def git_commit(milestone_id: str, summary: str) -> int:
    # Caveman-style commit: "<id>: <summary>"
    msg = f"{milestone_id}: {summary}"
    rc = run(["git", "add", "-A"], "git add")
    if rc != 0:
        return rc
    # Skip commit if nothing staged.
    diff_rc = subprocess.call(
        ["git", "diff", "--cached", "--quiet"], cwd=ROOT
    )
    if diff_rc == 0:
        print("  → (no staged changes; skipping commit)")
        return 0
    return run(["git", "commit", "-m", msg], "git commit")


def append_learning(milestone_id: str, summary: str) -> None:
    today = date.today().isoformat()
    block = (
        f"\n## {today} · Milestone {milestone_id} completed ✅\n\n"
        f"{summary}\n\n"
        f"*Auto-appended by milestone.py. Edit freely to add detail.*\n"
    )
    text = LEARNINGS.read_text(encoding="utf-8")
    split_marker = "---\n"
    if split_marker in text:
        head, rest = text.split(split_marker, 1)
        LEARNINGS.write_text(head + split_marker + block + rest, encoding="utf-8")
    else:
        LEARNINGS.write_text(text + block, encoding="utf-8")
    print(f"  → LEARNINGS.md: +1 entry ({milestone_id})")


def touch_summary_timestamp() -> None:
    today = date.today().isoformat()
    text = SUMMARY.read_text(encoding="utf-8")
    text = re.sub(
        r"\*Last updated: \d{4}-\d{2}-\d{2}\*",
        f"*Last updated: {today}*",
        text,
        count=1,
    )
    SUMMARY.write_text(text, encoding="utf-8")
    print(f"  → SESSION_SUMMARY.md: timestamp {today}")


def _parse_arg_value(argv: list[str], flag: str) -> str | None:
    if flag in argv:
        i = argv.index(flag)
        if i + 1 < len(argv):
            return argv[i + 1]
    return None


def record_observation(
    milestone_id: str,
    summary: str,
    cost_tokens: int | None,
    confidence: str | None,
    task_tag: str | None,
) -> int:
    """Append a single NDJSON observation row to logs/task_observations.jsonl.
    Non-fatal: failure here doesn't halt the milestone."""
    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        from observation import record  # noqa: E402
        from queue import infer_task_tag  # noqa: E402

        # Detect current model + effort
        det = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "detect_level.py"), "--json"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        try:
            d = __import__("json").loads(det.stdout)
            model = d.get("model", "unknown")
            effort = d.get("effort", "unknown")
        except Exception:
            model, effort = "unknown", "unknown"

        tag = task_tag or infer_task_tag(summary)
        record(
            milestone_id=milestone_id,
            model=model,
            effort=effort,
            task_tag=tag,
            passed_first_try=True,  # we only reach this step on green
            self_tokens=cost_tokens,
            confidence=confidence,
            wall_clock_min=None,
            completed_turns_delta=None,
            milestone_exit_code=0,
            source="milestone",
        )
        print(f"  → observation: tag={tag} tokens={cost_tokens} confidence={confidence}")
        return 0
    except Exception as exc:
        print(f"  → observation skipped (non-fatal): {exc}")
        return 0


def run_calibrate_maybe() -> int:
    """Run calibrate.py --maybe (no-op unless ≥5 new observations)."""
    return run(
        [
            sys.executable,
            str(ROOT / "scripts" / "calibrate.py"),
            "--maybe",
        ],
        "calibrate --maybe",
    )


def run_changelog() -> int:
    """Regenerate CHANGELOG.md from git log (I-09). Non-fatal."""
    return run(
        [sys.executable, str(ROOT / "scripts" / "changelog.py")],
        "changelog.py",
    )


def run_snapshot(milestone_id: str) -> int:
    """Optional Chrome MCP screenshot via scripts/snapshot.py (I-10).
    Skipped silently if Chrome MCP not connected or script absent."""
    snap = ROOT / "scripts" / "snapshot.py"
    if not snap.exists():
        return 0  # not yet built; non-fatal
    return run(
        [sys.executable, str(snap), "--milestone-id", milestone_id, "--quiet-on-skip"],
        "snapshot.py",
    )


def run_memory_backup() -> int:
    """rsync canonical project memory to ~/.claude/backups/<ts>/ (I-13).
    Non-fatal — backup failure never halts the milestone."""
    from datetime import datetime
    from pathlib import Path as _Path
    src = _Path.home() / ".claude" / "projects" / "-Users-ianmcadam-Documents-Claude-Projects-EV-dashboard" / "memory"
    if not src.exists():
        return 0  # nothing to back up
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = _Path.home() / ".claude" / "backups" / f"ev-dashboard_{ts}"
    return run(
        ["rsync", "-a", str(src) + "/", str(dst) + "/"],
        f"rsync memory → backups/ev-dashboard_{ts}",
    )


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(
            'Usage: python3 scripts/milestone.py <id> "<caveman summary>" '
            "[--skip-git] [--cost-tokens N] [--confidence low|medium|high] [--task-tag TAG]"
        )
        return 2
    milestone_id = argv[1]
    summary = argv[2]
    skip_git = "--skip-git" in argv
    cost_tokens_str = _parse_arg_value(argv, "--cost-tokens")
    cost_tokens = int(cost_tokens_str) * 1000 if cost_tokens_str else None  # passed in 1000s
    confidence = _parse_arg_value(argv, "--confidence")
    task_tag = _parse_arg_value(argv, "--task-tag")

    print(f"Ritual: {milestone_id} — {summary}")

    total = 16

    step(1, total, "tsc typecheck")
    if run_typecheck() != 0:
        print("  ✗ HALT: tsc errors. Fix and rerun.")
        return 1

    step(2, total, "npm test (vitest)")
    if run_tests() != 0:
        print("  ✗ HALT: test failures. Fix and rerun.")
        return 1

    step(3, total, "cargo test (Rust thermal plugin)")
    if run_cargo_tests() != 0:
        print("  ✗ HALT: Rust test failures. Fix and rerun.")
        return 1

    step(4, total, "drive_app.py --smoke (debug-log regression guard)")
    if run_drive_app_smoke() != 0:
        print("  ✗ HALT: drive_app smoke failed.")
        return 1

    step(5, total, "validate.py (seed integrity)")
    if run_validate() != 0:
        print("  ✗ HALT: seed integrity failure. Fix and rerun.")
        return 1

    step(6, total, "metrics.py (regenerate PHASE_METRICS.md)")
    if run_metrics() != 0:
        print("  ✗ HALT: metrics regen failed.")
        return 1

    step(7, total, "LEARNINGS.md append")
    append_learning(milestone_id, summary)

    step(8, total, "SESSION_SUMMARY.md timestamp")
    touch_summary_timestamp()

    step(9, total, "queue.py re-rank")
    run_queue()  # non-fatal

    step(10, total, "recommend_model.py (level recs + deferred-tasks log)")
    run_recommend_model()  # non-fatal — only nudges to stdout, always logs

    step(11, total, "record observation (empirical learning loop)")
    record_observation(milestone_id, summary, cost_tokens, confidence, task_tag)

    step(12, total, "calibrate.py --maybe (recalibrate constants if ≥5 new obs)")
    run_calibrate_maybe()  # non-fatal — silent unless changes apply

    if not skip_git:
        step(13, total, "git commit")
        if git_commit(milestone_id, summary) != 0:
            print("  ✗ HALT: git commit failed.")
            return 1
    else:
        step(13, total, "git commit (skipped)")

    step(14, total, "changelog.py (regenerate CHANGELOG.md)")
    run_changelog()  # non-fatal

    step(15, total, "snapshot.py (Chrome MCP screenshot if available)")
    run_snapshot(milestone_id)  # non-fatal — graceful skip

    step(16, total, "memory backup (rsync to ~/.claude/backups/)")
    run_memory_backup()  # non-fatal

    # Self-audit every 5 milestones
    run_self_audit_if_due()

    print("\n✅ Ritual complete. Milestone accepted.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
