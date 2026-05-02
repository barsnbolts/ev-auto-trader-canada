#!/usr/bin/env python3
"""recommend_model.py — bidirectional model+effort recommender.

Reads:
  - current model + effort  (via detect_level.py, or --simulate <model>:<effort>)
  - ranked queue            (via queue.parse_plan + queue.rank)

Writes:
  - logs/level_recs.md       (always — append one timestamped line)
  - logs/deferred_tasks.md   (always — full rewrite, grouped by required level)

Prints:
  - quiet by default
  - one-line nudge to stdout when an active recommendation fires
    (≥3× cost saving from a downshift OR top-priority task blocked by current level)

Usage:
  python3 scripts/recommend_model.py                    # detect + log + maybe nudge
  python3 scripts/recommend_model.py --simulate sonnet:medium  # what-if
  python3 scripts/recommend_model.py --json             # full machine-readable output
  python3 scripts/recommend_model.py --append-log       # called by milestone.py

Decision branches (from the H10 spec):
  - skipped[0..2] contains a top-3 priority item one model-tier above current → nudge UP
  - next 3 compatible items all fit a strictly cheaper level (≥3× saving) → nudge DOWN
  - else → silent (still log, still update deferred_tasks.md)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from cost_model import (
    EFFORT_COST,
    MODEL_COST,
    cheapest_compatible,
    estimate,
    normalize_effort,
    normalize_model,
)
from queue import infer_task_tag, parse_plan, rank
from task_complexity import effort_rank, fits, model_rank

DETECT = SCRIPTS / "detect_level.py"
LOG_RECS = ROOT / "logs" / "level_recs.md"
LOG_DEFERRED = ROOT / "logs" / "deferred_tasks.md"

NUDGE_RATIO = 3.0  # ≥3× cost saving = active nudge


def detect_current() -> tuple[str, str] | None:
    res = subprocess.run(
        [sys.executable, str(DETECT), "--json"],
        check=False,
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        return None
    try:
        d = json.loads(res.stdout)
    except json.JSONDecodeError:
        return None
    if not d.get("ok"):
        return None
    return d.get("model", "unknown"), d.get("effort", "unknown")


def split_queue(model: str, effort: str, top_n: int = 10) -> tuple[list[dict], list[dict]]:
    """Return (compatible_top_n, skipped) ranked items."""
    items = parse_plan()
    ranked = rank(items, ready_only=True)
    compatible: list[dict] = []
    skipped: list[dict] = []
    for it in ranked:
        tag = infer_task_tag(it["title"])
        ok, _ = fits(effort, model, tag)
        annotated = dict(it, tag=tag)
        (compatible if ok else skipped).append(annotated)
    return compatible[:top_n], skipped


def decide(
    model: str, effort: str, compatible: list[dict], skipped: list[dict]
) -> dict:
    """Return decision dict.

    decision in {'stay', 'silent-swap', 'nudge-up', 'nudge-down', 'stop-no-work'}
    """
    if not compatible and not skipped:
        return {"decision": "stop-no-work", "reason": "queue is empty (all items done)"}

    # Active nudge UP: top-3 priority item is parked one model-tier above current.
    if skipped:
        # Look at top-3 by priority globally (compatible + skipped, re-ranked).
        all_ranked = sorted(compatible + skipped, key=lambda i: -i["priority"])[:3]
        for it in all_ranked:
            if it in skipped:
                from task_complexity import lookup as task_lookup

                min_effort, min_model, why = task_lookup(it["tag"])
                jump = model_rank(min_model) - model_rank(model)
                if jump <= 1 and jump >= 0:
                    return {
                        "decision": "nudge-up",
                        "reason": (
                            f"top-priority item {it['id']} ({it['tag']}) blocked at "
                            f"{model}/{effort}; needs ≥{min_effort}/{min_model}"
                        ),
                        "target_model": min_model,
                        "target_effort": min_effort,
                        "blocked_item": it["id"],
                        "blocked_title": it["title"],
                    }

    if not compatible:
        return {
            "decision": "stop-no-work",
            "reason": "no compatible items at current level (all parked above)",
        }

    # Active nudge DOWN: next-3 compatible all fit a strictly cheaper level
    # AND combined cost saving across them is ≥ NUDGE_RATIO.
    next3 = compatible[:3]
    current_total = sum(estimate(model, effort, it["tag"])["cost_units"] for it in next3)
    cheapest_total = sum(cheapest_compatible(it["tag"])[2]["cost_units"] for it in next3)
    # Also derive the actual cheapest model/effort *common* to all three
    # (must satisfy all three's mins).
    if current_total > 0 and current_total / max(cheapest_total, 1) >= NUDGE_RATIO:
        # Pick a single (m, e) that fits all three — smallest cost.
        best_pair: tuple[str, str, float] | None = None
        for m in MODEL_COST:
            for e in EFFORT_COST:
                ok_for_all = all(fits(e, m, it["tag"])[0] for it in next3)
                if not ok_for_all:
                    continue
                tot = sum(estimate(m, e, it["tag"])["cost_units"] for it in next3)
                if best_pair is None or tot < best_pair[2]:
                    best_pair = (m, e, tot)
        if best_pair and best_pair[2] > 0 and current_total / best_pair[2] >= NUDGE_RATIO:
            saving = current_total / best_pair[2]
            return {
                "decision": "nudge-down",
                "reason": (
                    f"next 3 items ({', '.join(it['id'] for it in next3)}) all fit "
                    f"{best_pair[0]}/{best_pair[1]}; ~{saving:.1f}× cost saving"
                ),
                "target_model": best_pair[0],
                "target_effort": best_pair[1],
                "saving_factor": round(saving, 2),
                "items": [it["id"] for it in next3],
            }

    # Silent: just take top compatible.
    pick = compatible[0]
    return {
        "decision": "silent-swap" if skipped else "stay",
        "reason": f"top compatible item is {pick['id']} ({pick['tag']})",
        "pick": pick["id"],
        "pick_title": pick["title"],
    }


def write_deferred_log(skipped: list[dict], current_model: str, current_effort: str) -> None:
    LOG_DEFERRED.parent.mkdir(parents=True, exist_ok=True)
    if not skipped:
        LOG_DEFERRED.write_text(
            f"# Deferred tasks (none — all queue items fit {current_model}/{current_effort})\n",
            encoding="utf-8",
        )
        return
    from task_complexity import lookup as task_lookup

    groups: dict[str, list[dict]] = {}
    for it in skipped:
        min_effort, min_model, _ = task_lookup(it["tag"])
        key = f"{min_model}/{min_effort}"
        groups.setdefault(key, []).append(it)

    lines = [
        "# Deferred tasks — parked above current level",
        "",
        f"*Current: `{current_model} / {current_effort}`. Auto-rewritten by `scripts/recommend_model.py`.*",
        "",
    ]
    # Sort groups by required-level rank (ascending — closest to current first).
    def sort_key(k: str) -> tuple[int, int]:
        m, e = k.split("/", 1)
        return (model_rank(m), effort_rank(e))

    for key in sorted(groups.keys(), key=sort_key):
        lines.append(f"## Requires `{key}`")
        lines.append("")
        for it in groups[key]:
            lines.append(
                f"- **{it['id']}** [{it['tag']}] — {it['title']} "
                f"(value={it['value']:.0f}, cost={it['cost']:.0f}, prio={it['priority']:.2f})"
            )
        lines.append("")
    LOG_DEFERRED.write_text("\n".join(lines) + "\n", encoding="utf-8")


def append_recs_log(model: str, effort: str, decision: dict) -> None:
    LOG_RECS.parent.mkdir(parents=True, exist_ok=True)
    ts = dt.datetime.now().isoformat(timespec="seconds")
    reason = decision.get("reason", "").replace("|", "/")
    line = f"{ts} | {model} | {effort} | {decision['decision']} | {reason}\n"
    if not LOG_RECS.exists():
        LOG_RECS.write_text(
            "# Level recommendation log — append-only, one line per run\n\n", encoding="utf-8"
        )
    with LOG_RECS.open("a", encoding="utf-8") as fh:
        fh.write(line)


def parse_simulate(s: str) -> tuple[str, str]:
    if ":" not in s:
        raise SystemExit(f"--simulate expects model:effort, got: {s}")
    m, e = s.split(":", 1)
    return normalize_model(m), normalize_effort(e)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--simulate", help="model:effort (e.g. sonnet:medium) instead of detecting")
    ap.add_argument("--json", action="store_true")
    ap.add_argument(
        "--append-log",
        action="store_true",
        help="suppress non-nudge stdout (for milestone ritual)",
    )
    args = ap.parse_args()

    if args.simulate:
        model, effort = parse_simulate(args.simulate)
    else:
        found = detect_current()
        if found is None:
            print("could not detect active session", file=sys.stderr)
            return 2
        model, effort = found

    norm_model = normalize_model(model)
    norm_effort = normalize_effort(effort)

    compatible, skipped = split_queue(norm_model, norm_effort)
    decision = decide(norm_model, norm_effort, compatible, skipped)
    write_deferred_log(skipped, model, effort)
    append_recs_log(model, effort, decision)

    if args.json:
        print(
            json.dumps(
                {
                    "model": model,
                    "effort": effort,
                    "decision": decision,
                    "compatible_top": [i["id"] for i in compatible[:3]],
                    "skipped_top": [i["id"] for i in skipped[:3]],
                }
            )
        )
        return 0

    nudge = decision["decision"] in ("nudge-up", "nudge-down", "stop-no-work")
    if args.append_log and not nudge:
        return 0  # silent for milestone ritual

    if nudge:
        emoji = {"nudge-up": "↑", "nudge-down": "↓", "stop-no-work": "■"}[decision["decision"]]
        print(f"  {emoji} recommend: {decision['decision']} — {decision['reason']}")
        if decision["decision"] == "nudge-up":
            print(f"     switch to {decision['target_model']}/{decision['target_effort']} "
                  f"to unblock {decision['blocked_item']}")
        elif decision["decision"] == "nudge-down":
            print(f"     switch to {decision['target_model']}/{decision['target_effort']} "
                  f"for {len(decision['items'])} items "
                  f"({decision['saving_factor']}× cheaper)")
    else:
        print(f"  current {model}/{effort}: {decision['decision']} — {decision['reason']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
