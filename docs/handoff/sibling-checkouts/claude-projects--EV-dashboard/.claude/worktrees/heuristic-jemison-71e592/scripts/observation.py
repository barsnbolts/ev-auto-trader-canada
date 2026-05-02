"""observation.py — append a single NDJSON observation row to logs/task_observations.jsonl.

Used by:
  scripts/milestone.py  — step 4.5 records the milestone-just-run
  scripts/stress_test.py — records each stress-suite task

Schema (one line per row):
  {
    ts: int (ms),
    milestone_id: str,
    model: str,            # full ID from detect_level (e.g. "claude-opus-4-7[1m]")
    effort: str,           # "low" / "medium" / "high" / "xhigh" / "max"
    task_tag: str,         # one of task_complexity.TASKS keys
    passed_first_try: bool,
    indirect: {
      git_lines_changed: int,
      wall_clock_min: float,
      completed_turns_delta: int,
      milestone_exit_code: int,
    },
    self_estimate: {
      cost_tokens: int | null,
      confidence: "low" | "medium" | "high" | null,
    },
    source: "milestone" | "stress_test",
  }

Indirect fields are best-effort — `null` allowed if the source is unavailable.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
OBSERVATIONS = ROOT / "logs" / "task_observations.jsonl"
STRESS_RUNS = ROOT / "logs" / "stress_runs.jsonl"


def git_lines_changed(commit: str = "HEAD") -> int:
    """Lines changed in the given commit. Returns 0 on any failure."""
    try:
        res = subprocess.run(
            ["git", "diff", "--shortstat", f"{commit}~1..{commit}"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        if res.returncode != 0:
            return 0
        # "5 files changed, 240 insertions(+), 12 deletions(-)"
        out = res.stdout.strip()
        ins = 0
        dels = 0
        for tok in out.split(","):
            tok = tok.strip()
            if "insertion" in tok:
                ins = int(tok.split()[0])
            elif "deletion" in tok:
                dels = int(tok.split()[0])
        return ins + dels
    except (OSError, ValueError):
        return 0


def detect_completed_turns() -> int | None:
    """Read completedTurns from the active session JSON. None on miss."""
    try:
        res = subprocess.run(
            ["python3", str(ROOT / "scripts" / "detect_level.py"), "--json"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        if res.returncode != 0:
            return None
        d = json.loads(res.stdout)
        if not d.get("ok"):
            return None
        # completedTurns lives in the session JSON; detect_level only returns
        # a subset. Re-open the source file.
        src = d.get("source_file")
        if not src:
            return None
        with open(src, "r", encoding="utf-8") as fh:
            sess = json.load(fh)
        ct = sess.get("completedTurns")
        if isinstance(ct, int):
            return ct
        return None
    except (OSError, json.JSONDecodeError):
        return None


def record(
    *,
    milestone_id: str,
    model: str,
    effort: str,
    task_tag: str,
    passed_first_try: bool,
    self_tokens: int | None = None,
    confidence: str | None = None,
    wall_clock_min: float | None = None,
    completed_turns_delta: int | None = None,
    milestone_exit_code: int = 0,
    source: str = "milestone",
) -> Path:
    """Append one observation row. Returns the path written."""
    target = STRESS_RUNS if source == "stress_test" else OBSERVATIONS
    target.parent.mkdir(parents=True, exist_ok=True)

    row: dict[str, Any] = {
        "ts": _now_ms(),
        "milestone_id": milestone_id,
        "model": model,
        "effort": effort,
        "task_tag": task_tag,
        "passed_first_try": passed_first_try,
        "indirect": {
            "git_lines_changed": git_lines_changed(),
            "wall_clock_min": wall_clock_min,
            "completed_turns_delta": completed_turns_delta,
            "milestone_exit_code": milestone_exit_code,
        },
        "self_estimate": {
            "cost_tokens": self_tokens,
            "confidence": confidence,
        },
        "source": source,
    }
    with target.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")
    return target


def combined_cost_units(row: dict[str, Any]) -> int:
    """Single 'cost units' figure used by the calibrator. Conservative (max)."""
    self_est = row.get("self_estimate", {}) or {}
    self_tok = self_est.get("cost_tokens")
    indirect = row.get("indirect", {}) or {}
    lines = indirect.get("git_lines_changed") or 0
    turns = indirect.get("completed_turns_delta") or 0
    indirect_est = lines * 50 + turns * 1500
    if self_tok is None:
        return int(indirect_est)
    return int(max(self_tok, indirect_est))


def _now_ms() -> int:
    import time

    return int(time.time() * 1000)
