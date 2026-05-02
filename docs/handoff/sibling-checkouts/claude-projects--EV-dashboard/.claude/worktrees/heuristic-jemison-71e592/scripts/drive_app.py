#!/usr/bin/env python3
"""drive_app.py — verify an expected sequence of debug events occurred.

Reads the latest NDJSON debug log under logs/debug/, filters to a recent time
window, loads a scenario module from scripts/scenarios/, and runs its
`assert_trace(events)` function. Writes a markdown report to
logs/automation/<scenario>_<timestamp>.md and exits 0/1 based on pass/fail.

Usage:
    python3 scripts/drive_app.py --scenario fresh_load
    python3 scripts/drive_app.py --scenario compare_four --last-seconds 120
    python3 scripts/drive_app.py --list

Scenarios:
    fresh_load              — app loads clean, no errors
    compare_four            — user added 4 vehicles to compare
    slider_updates_rings    — slider change -> rings_update emitted
    plain_mode_persists     — plain/geek toggle fired + persisted
    leaflet_no_errors       — no error events in the window (Leaflet regression)

Design notes:
    - "Driving" the app (clicking buttons, moving sliders) is done externally
      by Chrome-MCP or Ian directly. This script only VERIFIES the log.
    - The app must be built with VITE_DEBUG=1 in .env.local so events are
      actually written. Otherwise the log file won't exist and we report that.
"""

from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEBUG_LOG_DIR = REPO_ROOT / "logs" / "debug"
AUTOMATION_DIR = REPO_ROOT / "logs" / "automation"
SCENARIOS_DIR = Path(__file__).resolve().parent / "scenarios"


def latest_log_path() -> Path | None:
    if not DEBUG_LOG_DIR.exists():
        return None
    files = sorted(DEBUG_LOG_DIR.glob("*.jsonl"))
    return files[-1] if files else None


def load_events(path: Path, last_seconds: int) -> list[dict]:
    cutoff_ms = (dt.datetime.now().timestamp() - last_seconds) * 1000
    events: list[dict] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            ts = event.get("ts", 0)
            if ts >= cutoff_ms:
                events.append(event)
    return events


def load_scenario(name: str):
    path = SCENARIOS_DIR / f"{name}.py"
    if not path.exists():
        raise SystemExit(f"scenario not found: {name} (expected {path})")
    # Scenarios use sibling-relative imports like `from _helpers import ...`.
    # Put SCENARIOS_DIR on sys.path first so those resolve.
    if str(SCENARIOS_DIR) not in sys.path:
        sys.path.insert(0, str(SCENARIOS_DIR))
    spec = importlib.util.spec_from_file_location(f"scenarios.{name}", path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"cannot load scenario spec: {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def write_report(
    scenario: str,
    results: list[tuple[bool, str]],
    events_seen: int,
    log_path: Path | None,
) -> Path:
    AUTOMATION_DIR.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    out = AUTOMATION_DIR / f"{scenario}_{stamp}.md"
    passes = sum(1 for ok, _ in results if ok)
    total = len(results)
    lines = [
        f"# drive_app.py — scenario `{scenario}`",
        "",
        f"Timestamp: {dt.datetime.now().isoformat(timespec='seconds')}",
        f"Log: {log_path if log_path else '(none)'}",
        f"Events in window: {events_seen}",
        f"Result: **{passes}/{total} assertions passed**",
        "",
        "## Assertions",
        "",
    ]
    for ok, msg in results:
        lines.append(f"- {'✅' if ok else '❌'} {msg}")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out


def run_scenario(name: str, last_seconds: int, smoke: bool) -> int:
    log_path = latest_log_path()
    if log_path is None:
        print(
            f"no log file under {DEBUG_LOG_DIR} — did you set VITE_DEBUG=1 "
            "in .env.local and run the app?",
            file=sys.stderr,
        )
        # In smoke mode we exit 0 — absence of the log just means nobody ran
        # the app yet; don't break the milestone ritual on a fresh checkout.
        return 0 if smoke else 1

    events = load_events(log_path, last_seconds)
    scenario = load_scenario(name)
    results = scenario.assert_trace(events)
    report = write_report(name, results, len(events), log_path)
    passes = sum(1 for ok, _ in results if ok)
    total = len(results)
    print(f"{name}: {passes}/{total} — report at {report}")
    return 0 if passes == total else 1


def list_scenarios() -> int:
    if not SCENARIOS_DIR.exists():
        print(f"no scenarios dir: {SCENARIOS_DIR}")
        return 1
    for p in sorted(SCENARIOS_DIR.glob("*.py")):
        if p.name.startswith("_"):
            continue
        print(f"  {p.stem}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--scenario", help="scenario name (see --list)")
    ap.add_argument("--last-seconds", type=int, default=60)
    ap.add_argument(
        "--smoke",
        action="store_true",
        help="in smoke mode, absent log is not a failure (for milestone ritual)",
    )
    ap.add_argument("--list", action="store_true", help="list scenarios and exit")
    args = ap.parse_args()
    if args.list:
        return list_scenarios()
    if not args.scenario:
        ap.error("--scenario required (or --list)")
    return run_scenario(args.scenario, args.last_seconds, args.smoke)


if __name__ == "__main__":
    sys.exit(main())
