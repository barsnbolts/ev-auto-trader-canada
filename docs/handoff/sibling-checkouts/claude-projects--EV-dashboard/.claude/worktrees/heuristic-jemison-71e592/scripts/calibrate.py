#!/usr/bin/env python3
"""calibrate.py — empirical learning loop for cost_model.py + task_complexity.py.

Reads observations from logs/task_observations.jsonl (and optionally
logs/stress_runs.jsonl) and proposes/applies updates to:
  - cost_model.TASK_TOKENS  (per-tag token estimates)
  - task_complexity.TASKS    (per-tag min effort + min model)

Asymmetric aggression policy (per Ian, conservative-down + eager-up):
  - LOWER min for a tag: requires ≥3 consecutive successful observations of
    that tag at a strictly cheaper (model, effort) than current min. A single
    failure at the cheaper level resets the consecutive counter.
  - RAISE min for a tag: a single failed observation at the current min level
    immediately bumps that tag's min up one tier.
  - UPDATE TASK_TOKENS for a tag: ≥5 observations AND median changes by ≥20%
    from current value.

Usage:
  python3 scripts/calibrate.py                 # human-readable summary
  python3 scripts/calibrate.py --dry-run       # propose only, do not write
  python3 scripts/calibrate.py --force         # run even if <5 new since last
  python3 scripts/calibrate.py --maybe         # no-op unless ≥5 new (milestone)
  python3 scripts/calibrate.py --include-stress  # fold stress_runs.jsonl too
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import statistics
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from cost_model import (
    MODEL_COST,
    EFFORT_COST,
    TASK_TOKENS,
    apply_calibration as apply_token_updates,
    normalize_effort,
    normalize_model,
)
from observation import combined_cost_units
from task_complexity import (
    TASKS,
    apply_calibration as apply_min_updates,
    effort_rank,
    model_rank,
)

OBSERVATIONS = ROOT / "logs" / "task_observations.jsonl"
STRESS_RUNS = ROOT / "logs" / "stress_runs.jsonl"
CHANGES_LOG = ROOT / "logs" / "calibration_changes.md"
STATE_FILE = ROOT / "logs" / ".calibrate_state.json"

MIN_OBS_FOR_TOKENS = 5
TOKEN_CHANGE_THRESHOLD = 0.20  # 20%
MIN_CONSECUTIVE_SUCCESS_TO_LOWER = 3

EFFORT_ORDER_LIST = ["low", "medium", "high", "xhigh", "max"]
MODEL_ORDER_LIST = ["haiku", "sonnet", "opus"]


def _load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def _load_state() -> dict:
    if not STATE_FILE.exists():
        return {"last_run_obs_count": 0}
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"last_run_obs_count": 0}


def _save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state), encoding="utf-8")


def _normalize(row: dict) -> dict:
    """Add canonical model/effort tier names so grouping works across raw IDs."""
    row = dict(row)
    row["_model_canon"] = normalize_model(row.get("model", ""))
    row["_effort_canon"] = normalize_effort(row.get("effort", ""))
    return row


def _next_lower_level(model: str, effort: str) -> tuple[str, str] | None:
    """One step cheaper. Drop effort first, then model. None if at floor."""
    e_idx = EFFORT_ORDER_LIST.index(effort) if effort in EFFORT_ORDER_LIST else 1
    if e_idx > 0:
        return model, EFFORT_ORDER_LIST[e_idx - 1]
    m_idx = MODEL_ORDER_LIST.index(model) if model in MODEL_ORDER_LIST else 1
    if m_idx > 0:
        return MODEL_ORDER_LIST[m_idx - 1], "max"
    return None


def _next_higher_level(model: str, effort: str) -> tuple[str, str] | None:
    """One step costlier. Raise effort first, then model."""
    e_idx = EFFORT_ORDER_LIST.index(effort) if effort in EFFORT_ORDER_LIST else 1
    if e_idx < len(EFFORT_ORDER_LIST) - 1:
        return model, EFFORT_ORDER_LIST[e_idx + 1]
    m_idx = MODEL_ORDER_LIST.index(model) if model in MODEL_ORDER_LIST else 1
    if m_idx < len(MODEL_ORDER_LIST) - 1:
        return MODEL_ORDER_LIST[m_idx + 1], "low"
    return None


def _is_strictly_cheaper(model_a: str, effort_a: str, model_b: str, effort_b: str) -> bool:
    """True if (model_a, effort_a) is strictly cheaper than (model_b, effort_b)."""
    cost_a = MODEL_COST.get(model_a, 99) * EFFORT_COST.get(effort_a, 99)
    cost_b = MODEL_COST.get(model_b, 99) * EFFORT_COST.get(effort_b, 99)
    return cost_a < cost_b


def _is_at_or_above(model: str, effort: str, min_model: str, min_effort: str) -> bool:
    return (
        model_rank(model) >= model_rank(min_model)
        and effort_rank(effort) >= effort_rank(min_effort)
    )


def _consecutive_successes(rows_for_tag: list[dict], at_model: str, at_effort: str) -> int:
    """How many of the most-recent observations at the given level passed?
    Stops counting at the first failure encountered (most recent → oldest).
    """
    streak = 0
    for r in reversed(rows_for_tag):
        if r["_model_canon"] != at_model or r["_effort_canon"] != at_effort:
            continue
        if r.get("passed_first_try"):
            streak += 1
        else:
            break
    return streak


def _any_recent_failure(rows_for_tag: list[dict], at_model: str, at_effort: str) -> bool:
    """True if any observation at this level (most recent first, last 5) failed."""
    seen = 0
    for r in reversed(rows_for_tag):
        if r["_model_canon"] != at_model or r["_effort_canon"] != at_effort:
            continue
        if not r.get("passed_first_try"):
            return True
        seen += 1
        if seen >= 5:
            break
    return False


def _weighted_median_tokens(rows: Iterable[dict]) -> int | None:
    """Median of combined_cost_units, weighted by self-estimate confidence
    (low=1, medium=2, high=3). Returns None if no rows."""
    weighted: list[int] = []
    for r in rows:
        units = combined_cost_units(r)
        conf = (r.get("self_estimate") or {}).get("confidence")
        weight = {"low": 1, "medium": 2, "high": 3}.get(conf or "medium", 2)
        for _ in range(weight):
            weighted.append(units)
    if not weighted:
        return None
    return int(statistics.median(weighted))


def compute_min_updates(observations: list[dict]) -> dict[str, tuple[str, str]]:
    """Return {tag: (new_min_effort, new_min_model)} per the asymmetric rules."""
    by_tag: dict[str, list[dict]] = {}
    for r in observations:
        tag = r.get("task_tag", "default")
        by_tag.setdefault(tag, []).append(r)

    updates: dict[str, tuple[str, str]] = {}
    for tag, rows in by_tag.items():
        if tag not in TASKS:
            continue
        min_effort, min_model, _ = TASKS[tag]

        # 1) RAISE: any failure at current min level → bump up one tier
        if _any_recent_failure(rows, min_model, min_effort):
            higher = _next_higher_level(min_model, min_effort)
            if higher and higher != (min_model, min_effort):
                updates[tag] = (higher[1], higher[0])  # (new_effort, new_model)
                continue  # don't also lower

        # 2) LOWER: ≥3 consecutive successes at one step below → lower min
        lower = _next_lower_level(min_model, min_effort)
        if lower and _is_strictly_cheaper(lower[0], lower[1], min_model, min_effort):
            cheaper_model, cheaper_effort = lower
            streak = _consecutive_successes(rows, cheaper_model, cheaper_effort)
            if streak >= MIN_CONSECUTIVE_SUCCESS_TO_LOWER:
                updates[tag] = (cheaper_effort, cheaper_model)

    return updates


def compute_token_updates(observations: list[dict]) -> dict[str, int]:
    """Return {tag: new_token_estimate} where ≥5 obs and ≥20 % drift."""
    by_tag: dict[str, list[dict]] = {}
    for r in observations:
        tag = r.get("task_tag", "default")
        by_tag.setdefault(tag, []).append(r)

    updates: dict[str, int] = {}
    for tag, rows in by_tag.items():
        if tag not in TASK_TOKENS:
            continue
        recent = rows[-10:]
        if len(recent) < MIN_OBS_FOR_TOKENS:
            continue
        new_est = _weighted_median_tokens(recent)
        if new_est is None:
            continue
        # Round to nearest 1k for stability
        new_est = max(1000, int(round(new_est / 1000) * 1000))
        old = TASK_TOKENS[tag]
        if old <= 0:
            continue
        if abs(new_est - old) / old >= TOKEN_CHANGE_THRESHOLD:
            updates[tag] = new_est
    return updates


def append_changes_log(token_changes: list, min_changes: list, n_obs: int) -> None:
    if not token_changes and not min_changes:
        return
    CHANGES_LOG.parent.mkdir(parents=True, exist_ok=True)
    if not CHANGES_LOG.exists():
        CHANGES_LOG.write_text(
            "# Calibration changes log — append-only, written by scripts/calibrate.py\n\n",
            encoding="utf-8",
        )
    with CHANGES_LOG.open("a", encoding="utf-8") as fh:
        ts = dt.datetime.now().isoformat(timespec="seconds")
        fh.write(f"## {ts} — {n_obs} observations\n\n")
        if min_changes:
            fh.write("**TASKS minimums:**\n")
            for tag, old, new in min_changes:
                fh.write(f"- `{tag}` : `{old[1]}/{old[0]}` → `{new[1]}/{new[0]}`\n")
            fh.write("\n")
        if token_changes:
            fh.write("**TASK_TOKENS:**\n")
            for tag, old, new in token_changes:
                fh.write(f"- `{tag}` : {old:,} → {new:,}\n")
            fh.write("\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="propose only, no writes")
    ap.add_argument("--force", action="store_true", help="run even with <5 new since last")
    ap.add_argument(
        "--maybe", action="store_true", help="no-op unless ≥5 new since last (for milestone)"
    )
    ap.add_argument(
        "--include-stress", action="store_true", help="fold stress_runs.jsonl too"
    )
    args = ap.parse_args()

    obs = _load_jsonl(OBSERVATIONS)
    if args.include_stress:
        obs = obs + _load_jsonl(STRESS_RUNS)
    obs = [_normalize(r) for r in obs]
    obs.sort(key=lambda r: r.get("ts", 0))

    state = _load_state()
    last_count = state.get("last_run_obs_count", 0)
    new_since_last = len(obs) - last_count

    if args.maybe and new_since_last < 5 and not args.force:
        # Silent no-op for milestone ritual
        return 0

    if not obs:
        print("calibrate.py: no observations yet")
        return 0

    token_updates = compute_token_updates(obs)
    min_updates = compute_min_updates(obs)

    if not token_updates and not min_updates:
        print(f"calibrate.py: no changes ({len(obs)} obs total, {new_since_last} new)")
        if not args.dry_run:
            state["last_run_obs_count"] = len(obs)
            _save_state(state)
        return 0

    print(f"calibrate.py: {len(obs)} obs total, {new_since_last} new since last run")
    if min_updates:
        print("  proposed TASKS min updates:")
        for tag, (eff, mod) in min_updates.items():
            old_eff, old_mod, _ = TASKS[tag]
            print(f"    {tag}: {old_mod}/{old_eff} → {mod}/{eff}")
    if token_updates:
        print("  proposed TASK_TOKENS updates:")
        for tag, val in token_updates.items():
            print(f"    {tag}: {TASK_TOKENS[tag]:,} → {val:,}")

    if args.dry_run:
        print("  (--dry-run, not applying)")
        return 0

    token_changes = apply_token_updates(token_updates) if token_updates else []
    min_changes = apply_min_updates(min_updates) if min_updates else []
    append_changes_log(token_changes, min_changes, len(obs))
    state["last_run_obs_count"] = len(obs)
    _save_state(state)
    print(
        f"  applied: {len(min_changes)} min update(s), {len(token_changes)} token update(s)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
