#!/usr/bin/env python3
"""
Milestone ritual runner. Run this the moment a milestone is declared done.
It enforces the self-learning loop AND validates its own health.

Pipeline (all steps, in order, fail-fast):
    1. Regenerate PHASE_METRICS.md (metrics.py)
    2. Validate self-learning system consistency (validate_system.py)
    3. Validate thermal physics model against anchor points (validate_thermal.py)
    4. Snapshot current seed.json into snapshots/
    5. Append a timestamped entry to LEARNINGS.md
    6. Touch SESSION_SUMMARY.md 'Last updated' date
    7. Log cost to milestone_costs.jsonl (cost_tracker.py)
    8. Token-ROI gate — fail if spend > 2× peer median without override
    9. Show the next 3 queue items (manual pick time)
   10. Print reflection prompts — explicit headroom for optimization thinking

Steps 1–2 fail loud: if metrics drift or the system fails validation,
the milestone cannot close until it's fixed. That IS the gate.

Usage:
    python3 scripts/milestone.py 3d "Wired range rings to Apple MapKit"
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
PLAN = ROOT / "AUTONOMOUS_PLAN.md"
SCRIPTS = ROOT / "scripts"


def run(label: str, args: list[str]) -> int:
    print(f"[{label}] $", " ".join(args))
    return subprocess.call(args)


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
    print(f"  → LEARNINGS.md: added entry for {milestone_id}")


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
    print(f"  → SESSION_SUMMARY.md: touched timestamp")


def top_queue_items(n: int = 3) -> list[str]:
    """Parse queue table rows and return first N non-completed item summaries."""
    if not PLAN.exists():
        return []
    text = PLAN.read_text(encoding="utf-8")
    # Match rows like:  | 1 | **F-02** | Cost-per-100 km ... | 3 | 1 | 1 | ...
    row_re = re.compile(
        r"^\|\s*(\d+)\s*\|\s*\*\*([A-Z][\w\-/]+)\*\*\s*\|\s*([^|]+?)\s*\|",
        re.MULTILINE,
    )
    results: list[tuple[int, str, str]] = []
    for m in row_re.finditer(text):
        results.append((int(m.group(1)), m.group(2), m.group(3)))
    # Sort by row number (queue order), return first N
    results.sort(key=lambda r: r[0])
    return [f"{rid}: {title}" for _, rid, title in results[:n]]


def print_reflection_prompts() -> None:
    print("")
    print("━" * 60)
    print("REFLECTION — spend a minute here before next milestone")
    print("━" * 60)
    print("  • What was surprising about this milestone?")
    print("  • What went faster / slower than expected?")
    print("  • Any queue items that should be re-ranked based on what we learned?")
    print("  • Any bugs or polish opportunities observed — add them to the queue?")
    print("  • Anything in the plan that's now obsolete — move to Graveyard?")
    print("")
    print("  Edit LEARNINGS.md to capture anything non-obvious.")
    print("  Edit AUTONOMOUS_PLAN.md if the queue needs re-ranking.")
    print("━" * 60)


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("Usage: python3 scripts/milestone.py <id> \"<summary>\"")
        return 2
    milestone_id = argv[1]
    summary = argv[2]

    print(f"Ritual: milestone {milestone_id}")
    print(f"Summary: {summary}")
    print("")

    # 1. Metrics
    print("[1/7] Regenerating PHASE_METRICS.md …")
    rc = run("metrics", [sys.executable, str(SCRIPTS / "metrics.py")])
    if rc != 0:
        print("  ✗ metrics.py failed. Milestone cannot close until fixed.")
        return rc

    # 2. System validation gate
    print("\n[2/7] Validating self-learning system consistency …")
    rc = run("validate", [sys.executable, str(SCRIPTS / "validate_system.py")])
    if rc != 0:
        print("  ✗ validate_system.py found errors. Fix before closing milestone.")
        return rc

    # 3. Thermal model anchor validation
    print("\n[3/7] Validating thermal physics model against anchors …")
    rc = run("thermal", [sys.executable, str(SCRIPTS / "validate_thermal.py")])
    if rc != 0:
        print("  ✗ validate_thermal.py found model drift. Fix before closing milestone.")
        return rc

    # 4. Snapshot
    print("\n[4/7] Snapshotting seed.json …")
    rc = run("snapshot", [sys.executable, str(SCRIPTS / "snapshot.py"), "--diff"])
    if rc != 0:
        print("  ⚠ snapshot.py returned non-zero but not fatal — milestone continues")

    # 5. LEARNINGS append
    print("\n[5/7] Appending LEARNINGS.md entry …")
    append_learning(milestone_id, summary)

    # 6. SUMMARY touch
    print("\n[6/7] Touching SESSION_SUMMARY.md timestamp …")
    touch_summary_timestamp()

    # 7. Cost tracker log — records this milestone's spend so future gates compare fairly
    print("\n[7/10] Logging milestone cost …")
    # kind inferred from id; estimated is free-form. Summary passed through.
    rc = run("cost_tracker", [
        sys.executable, str(SCRIPTS / "cost_tracker.py"),
        "log", milestone_id, "auto", "tokens", summary,
    ])
    if rc != 0:
        print("  ⚠ cost_tracker.log failed — continuing (non-fatal).")

    # 8. Token-ROI gate — refuses close if this milestone cost > 2× peer median
    print("\n[8/10] Token-ROI gate …")
    rc = run("token_roi", [
        sys.executable, str(SCRIPTS / "token_roi.py"),
        "gate", milestone_id,
    ])
    if rc != 0:
        print("  ✗ ROI gate failed. Set TOKEN_ROI_OVERRIDE=1 and rerun if intentional.")
        return rc

    # 9. Queue forward-look
    print("\n[9/10] Up next in the queue:")
    for item in top_queue_items(3):
        print(f"  → {item}")

    # 10. Reflection
    print("\n✅ Ritual complete.")
    print_reflection_prompts()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
