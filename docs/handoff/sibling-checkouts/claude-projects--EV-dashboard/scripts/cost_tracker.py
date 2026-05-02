#!/usr/bin/env python3
"""
Cost-tracker — log and analyze actual milestone cost so future estimates
calibrate against real data instead of vibes.

Logs every milestone to `logs/milestone_costs.jsonl` with:
  - milestone_id, kind (inferred from prefix)
  - timestamp (close)
  - estimated units (hours etc, from planning)
  - actual units we can measure:
      * files_touched (count of git diff or files-changed enumeration)
      * subagent_tokens (sum from logs/subagent_runs/ entries tagged with this milestone)
      * subagent_count
      * tool_calls (rough proxy — lines in PHASE_METRICS delta / N)
  - summary one-liner

Companion `analyze` mode prints median/p90 by kind so future plans can
reference "typical cost of a data-batch milestone: 120k tokens, 1 subagent."

Usage:
    python3 scripts/cost_tracker.py log <milestone_id> <kind> <estimated_hours> "<summary>"
    python3 scripts/cost_tracker.py analyze
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict, Counter
from datetime import datetime
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parent.parent
LOG_PATH = ROOT / "logs" / "milestone_costs.jsonl"
AGENT_LOGS = ROOT / "logs" / "subagent_runs"


def infer_kind(mid: str) -> str:
    if mid.startswith("BATCH-"):
        return "batch"
    if mid.startswith("D-"):
        return "data"
    if mid.startswith("F-"):
        return "feature"
    if mid.startswith("I-"):
        return "infra"
    if mid.startswith("B-"):
        return "bugfix"
    if mid.startswith("P-"):
        return "polish"
    return "other"


def subagent_tokens_for(mid: str) -> tuple[int, int]:
    """Sum tokens + count dispatches for a given milestone id."""
    if not AGENT_LOGS.exists():
        return 0, 0
    total = 0
    count = 0
    for p in AGENT_LOGS.glob("*.json"):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if data.get("milestone") == mid or mid in p.stem:
            total += data.get("usage", {}).get("tokens_total", 0)
            count += 1
    return total, count


def log_milestone(mid: str, kind: str, estimated: str, summary: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    tokens, n_agents = subagent_tokens_for(mid)
    entry = {
        "id": mid,
        "kind": kind or infer_kind(mid),
        "closed_at": datetime.utcnow().isoformat() + "Z",
        "estimated": estimated,
        "actual_subagent_tokens": tokens,
        "actual_subagent_count": n_agents,
        "summary_head": summary[:140],
    }
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry) + "\n")
    print(f"logged {mid} ({entry['kind']}) · {tokens:,} subagent tokens · est {estimated}")


def analyze() -> None:
    if not LOG_PATH.exists():
        print("no milestone cost log yet — run `cost_tracker.py log` first")
        return
    entries = []
    with LOG_PATH.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except Exception:
                pass
    if not entries:
        print("log is empty")
        return

    by_kind: dict[str, list[dict]] = defaultdict(list)
    for e in entries:
        by_kind[e.get("kind", "other")].append(e)

    print(f"Milestone cost analysis · {len(entries)} total entries\n")
    print(f"{'kind':10} {'count':>6} {'median tokens':>16} {'p90 tokens':>14} {'median agents':>14}")
    for kind in sorted(by_kind):
        items = by_kind[kind]
        tokens = [i.get("actual_subagent_tokens", 0) for i in items]
        agents = [i.get("actual_subagent_count", 0) for i in items]
        tokens_sorted = sorted(tokens)
        p90 = tokens_sorted[int(0.9 * (len(tokens_sorted) - 1))] if tokens_sorted else 0
        print(
            f"{kind:10} {len(items):>6} "
            f"{int(median(tokens) if tokens else 0):>16,} "
            f"{p90:>14,} "
            f"{median(agents) if agents else 0:>14.1f}"
        )

    total = sum(e.get("actual_subagent_tokens", 0) for e in entries)
    print(f"\nCumulative subagent spend: {total:,} tokens across {len(entries)} milestones")

    # Best-fit calibration message for future estimates.
    feature_median = median([
        e.get("actual_subagent_tokens", 0)
        for e in entries
        if e.get("kind") == "feature" and e.get("actual_subagent_tokens", 0) > 0
    ] or [0])
    data_median = median([
        e.get("actual_subagent_tokens", 0)
        for e in entries
        if e.get("kind") == "data" and e.get("actual_subagent_tokens", 0) > 0
    ] or [0])
    print("\nCalibration hints for future BATCH_PLAN estimates:")
    print(f"  · a 'data' milestone typically burns ~{int(data_median):,} subagent tokens")
    print(f"  · a 'feature' milestone ~{int(feature_median):,} subagent tokens")
    print(f"  · cost in WALL-CLOCK HOURS is unreliable; prefer token budgets + dispatch counts")


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: cost_tracker.py <log|analyze> …")
        return 2
    cmd = argv[1]
    if cmd == "log":
        if len(argv) < 6:
            print("Usage: cost_tracker.py log <milestone_id> <kind> <estimated> \"<summary>\"")
            return 2
        log_milestone(argv[2], argv[3], argv[4], argv[5])
        return 0
    if cmd == "analyze":
        analyze()
        return 0
    if cmd == "backfill":
        # Backfill from LEARNINGS.md + existing subagent logs.
        learnings = ROOT / "LEARNINGS.md"
        text = learnings.read_text(encoding="utf-8")
        for m in re.finditer(r"^## \d{4}-\d{2}-\d{2} · Milestone (\S+)\s+completed", text, re.MULTILINE):
            mid = m.group(1)
            kind = infer_kind(mid)
            tokens, n = subagent_tokens_for(mid)
            entry = {
                "id": mid,
                "kind": kind,
                "closed_at": "backfilled",
                "estimated": "unknown",
                "actual_subagent_tokens": tokens,
                "actual_subagent_count": n,
                "summary_head": "backfilled from LEARNINGS",
            }
            with LOG_PATH.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry) + "\n")
        print(f"backfilled {LOG_PATH}")
        return 0
    print(f"unknown command: {cmd}")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
