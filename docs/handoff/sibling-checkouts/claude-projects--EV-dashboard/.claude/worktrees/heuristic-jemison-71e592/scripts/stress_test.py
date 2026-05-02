#!/usr/bin/env python3
"""stress_test.py — print + record canonical-task probes for the current level.

Usage:
  python3 scripts/stress_test.py                   # print quick suite
  python3 scripts/stress_test.py --suite quick     # explicit
  python3 scripts/stress_test.py --task t1-rename  # one task only
  python3 scripts/stress_test.py --record t1-rename --passed
  python3 scripts/stress_test.py --record t1-rename --failed
  python3 scripts/stress_test.py --finish          # fold runs into calibrate

Records go to logs/stress_runs.jsonl with source="stress_test" so calibrate.py
--include-stress treats them alongside milestone observations.

The full prose description of each task lives in docs/stress_test_battery.md.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from observation import record  # noqa: E402

BATTERIES: dict[str, list[dict]] = {
    "quick": [
        {
            "id": "t1-rename",
            "tag": "rename-symbol",
            "instruction": (
                "Rename the `cad` formatter in src/lib/format.ts to `formatCad`. "
                "Update every call site so `npx tsc --noEmit` is still green."
            ),
            "rubric": (
                "tsc exits 0; `grep -rn '\\bcad(' src/` returns no matches."
            ),
        },
        {
            "id": "t2-test-mirror",
            "tag": "test-addition",
            "instruction": (
                "Add a vitest case to src/lib/labels.test.ts that checks "
                'resolve(TERM.peakDc, true) returns "Fast charging speed".'
            ),
            "rubric": "npm test -- labels passes the new case.",
        },
        {
            "id": "t3-summarize",
            "tag": "documentation",
            "instruction": (
                "Read src/components/CompareView.tsx. Write a 100-120 word "
                "summary of what it renders, the four tabs, and the Zustand "
                "state it reads. Output the summary in chat."
            ),
            "rubric": (
                "Summary names all four tabs (Specs / Trip Plan / Map & Range / "
                "Used Market), mentions useAppStore, stays inside 100-120 words."
            ),
        },
        {
            "id": "t4-bug-fix",
            "tag": "bug-fix-clear-repro",
            "instruction": (
                "Read specs/_stress/t4-bug-fix.md (created on first run if "
                "missing). Reproduce the bug with a failing test, then fix it."
            ),
            "rubric": "New test was red before the fix and green after.",
        },
        {
            "id": "t5-spec-stub",
            "tag": "spec-writing",
            "instruction": (
                "Read specs/_stress/t5-spec-stub.md. Write a complete spec "
                "with the six standard sections (Goal, User-visible behavior, "
                "Acceptance criteria, Inputs/state touched, Outputs, Test plan)."
            ),
            "rubric": "Spec contains all six sections; acceptance criteria are testable.",
        },
    ]
}


def detect_level() -> tuple[str, str]:
    res = subprocess.run(
        [sys.executable, str(SCRIPTS / "detect_level.py"), "--json"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    try:
        d = json.loads(res.stdout)
        if d.get("ok"):
            return d.get("model", "unknown"), d.get("effort", "unknown")
    except json.JSONDecodeError:
        pass
    return "unknown", "unknown"


def print_suite(suite: str, tasks: list[dict]) -> None:
    model, effort = detect_level()
    print(f"# Stress test — {suite} suite\n")
    print(f"Current level: **{model} / {effort}**\n")
    print(
        "After each task, log the outcome:\n"
        "  python3 scripts/stress_test.py --record <id> --passed\n"
        "  python3 scripts/stress_test.py --record <id> --failed\n"
        "When done with the whole suite, run --finish.\n"
    )
    for i, task in enumerate(tasks, 1):
        print(f"## {i}. `{task['id']}`  (tag: {task['tag']})\n")
        print(f"**Do:** {task['instruction']}\n")
        print(f"**Pass when:** {task['rubric']}\n")


def record_task(task_id: str, passed: bool) -> None:
    found = None
    for tasks in BATTERIES.values():
        for t in tasks:
            if t["id"] == task_id:
                found = t
                break
        if found:
            break
    if not found:
        print(f"unknown task id: {task_id}", file=sys.stderr)
        sys.exit(2)
    model, effort = detect_level()
    record(
        milestone_id=f"stress:{task_id}",
        model=model,
        effort=effort,
        task_tag=found["tag"],
        passed_first_try=passed,
        self_tokens=None,
        confidence=None,
        wall_clock_min=None,
        completed_turns_delta=None,
        milestone_exit_code=0 if passed else 1,
        source="stress_test",
    )
    print(f"recorded: {task_id} {'passed' if passed else 'failed'} at {model}/{effort}")


def finish() -> int:
    print("running calibrate.py --include-stress --force …")
    res = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "calibrate.py"),
            "--include-stress",
            "--force",
        ],
        cwd=ROOT,
    )
    return res.returncode


def ensure_stress_seed_files() -> None:
    """Create the placeholder spec files referenced by t4 + t5 if missing."""
    seed_dir = ROOT / "specs" / "_stress"
    seed_dir.mkdir(parents=True, exist_ok=True)
    t4 = seed_dir / "t4-bug-fix.md"
    if not t4.exists():
        t4.write_text(
            "# t4 — bug-fix probe\n\n"
            "**Pre-planted bug:** in `src/lib/format.ts`, `kw()` should round to "
            "the nearest 1 kW but currently uses `Math.floor`. So `kw(149.6)` "
            "returns 149 instead of 150.\n\n"
            "Write a vitest case in `src/lib/format.test.ts` that asserts "
            "`kw(149.6)` returns `150 kW`. Run it (red), fix `format.ts` to use "
            "`Math.round`, run again (green).\n",
            encoding="utf-8",
        )
    t5 = seed_dir / "t5-spec-stub.md"
    if not t5.exists():
        t5.write_text(
            "# t5 — spec-writing probe\n\n"
            "**Feature request (one line):** add a 'compare two trips' button "
            "in the Trip Plan tab so the user can see two routes side-by-side "
            "with their charging plans.\n\n"
            "Write a spec for this feature using the project's six-section "
            "template. Save the spec to specs/cluster-K/two-trip-compare.md.\n",
            encoding="utf-8",
        )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--suite", default="quick")
    ap.add_argument("--task", help="run/show only this task id")
    ap.add_argument("--record", help="record outcome for the given task id")
    ap.add_argument("--passed", action="store_true")
    ap.add_argument("--failed", action="store_true")
    ap.add_argument("--finish", action="store_true", help="fold runs into calibrate")
    args = ap.parse_args()

    if args.finish:
        return finish()
    if args.record:
        if args.passed == args.failed:
            print("--record requires exactly one of --passed or --failed", file=sys.stderr)
            return 2
        record_task(args.record, args.passed)
        return 0
    if args.suite not in BATTERIES:
        print(f"unknown suite: {args.suite}. Known: {', '.join(BATTERIES)}", file=sys.stderr)
        return 2
    ensure_stress_seed_files()
    tasks = BATTERIES[args.suite]
    if args.task:
        tasks = [t for t in tasks if t["id"] == args.task]
        if not tasks:
            print(f"unknown task id: {args.task}", file=sys.stderr)
            return 2
    print_suite(args.suite, tasks)
    return 0


if __name__ == "__main__":
    sys.exit(main())
