#!/usr/bin/env python3
"""
One-command session kickoff. Prints a dense status dashboard.

Run at the start of any session (or any time you want a quick status check)
to see: current stage, top queue items, recent learnings, seed health,
subagent activity, unresolved flags.

Usage:
    python3 scripts/kickoff.py
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
SUMMARY = ROOT / "SESSION_SUMMARY.md"
LEARNINGS = ROOT / "LEARNINGS.md"
PLAN = ROOT / "AUTONOMOUS_PLAN.md"
METRICS = ROOT / "PHASE_METRICS.md"
SNAPS = ROOT / "snapshots"
AGENT_LOGS = ROOT / "logs" / "subagent_runs"
SEED = ROOT / "src" / "data" / "seed.json"

RULE = "─" * 70


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


def section(title: str) -> None:
    print()
    print(f"▸ {title}")
    print(RULE)


def stage_line() -> None:
    t = read_text(SUMMARY)
    m = re.search(r"## Stage:\s*(.+)", t)
    if m:
        print(f"  Stage: {m.group(1).strip()}")


def top_queue(n: int = 5) -> None:
    t = read_text(PLAN)
    rows = re.findall(
        r"^\|\s*(\d+)\s*\|\s*\*\*([A-Z][\w\-/]+)\*\*\s*\|\s*([^|]+?)\s*\|",
        t,
        re.MULTILINE,
    )
    rows = [(int(n), rid, title) for n, rid, title in rows]
    rows.sort(key=lambda r: r[0])
    for _, rid, title in rows[:n]:
        print(f"  {rid:12s} {title}")


def recent_learnings(n: int = 3) -> None:
    t = read_text(LEARNINGS)
    headings = re.findall(r"^## (\d{4}-\d{2}-\d{2})\s*·\s*(.+)$", t, re.MULTILINE)
    for date, title in headings[:n]:
        print(f"  {date} · {title[:80]}")


def seed_health() -> None:
    t = read_text(METRICS)
    for line in t.splitlines():
        if line.startswith("| Confidence:") or line.startswith("| Vehicles") or line.startswith("| Brands"):
            # strip markdown pipes
            cells = [c.strip() for c in line.split("|") if c.strip()]
            if len(cells) >= 2:
                print(f"  {cells[0]:22s} {cells[1]}")


def snapshot_count() -> None:
    n = len(list(SNAPS.glob("*-seed.json"))) if SNAPS.exists() else 0
    print(f"  Snapshots on disk: {n}")


def subagent_activity() -> None:
    if not AGENT_LOGS.exists():
        print("  (no logs directory yet)")
        return
    logs = sorted(AGENT_LOGS.glob("*.json"))
    if not logs:
        print("  No subagent runs logged yet.")
        return
    for p in logs[-3:]:
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            print(f"  {p.stem}: {data.get('milestone', '?')} — "
                  f"{data.get('outcome', {}).get('pairs_returned', '?')} pairs, "
                  f"{data.get('usage', {}).get('tokens_total', '?')} tokens")
        except Exception as e:
            print(f"  {p.stem}: PARSE ERROR {e}")


def run_validators_summary() -> None:
    """Quick non-destructive validator checks — just show pass/fail."""
    for name, script in [("System", "validate_system.py"), ("Thermal", "validate_thermal.py")]:
        rc = subprocess.call(
            [sys.executable, str(ROOT / "scripts" / script)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        marker = "✓ green" if rc == 0 else "✗ FAILING"
        print(f"  {name:10s} {marker}")


def main() -> int:
    print()
    print(f"{'EV Dashboard — kickoff':<50s} {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 70)

    section("Stage")
    stage_line()

    section("Top of queue (next up)")
    top_queue(5)

    section("Seed health")
    seed_health()
    snapshot_count()

    section("Validator status")
    run_validators_summary()

    section("Recent subagent runs (last 3)")
    subagent_activity()

    section("Recent learnings (last 3)")
    recent_learnings(3)

    section("Token ROI pulse")
    # Invoke dashboard in-process to avoid extra subprocess cost
    try:
        import subprocess, sys as _sys
        subprocess.call([_sys.executable, str(Path(__file__).parent / "token_roi.py"), "spend"])
    except Exception as e:
        print(f"  (roi dashboard unavailable: {e})")

    section("Next action")
    print("  1. Pick top queue item OR 'reflect' if anything in LEARNINGS needs action.")
    print("  2. Execute. End with: python3 scripts/milestone.py <id> \"<summary>\"")
    print("  3. Commit on your Mac: git commit -am \"<milestone>\"")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
