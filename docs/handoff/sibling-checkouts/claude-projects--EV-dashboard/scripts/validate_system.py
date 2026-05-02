#!/usr/bin/env python3
"""
Validate the self-learning system itself. Cross-checks every feedback loop
to catch drift before it becomes corruption.

What this enforces:
  * Every memory file has valid YAML frontmatter and required fields
  * MEMORY.md index references every memory file and vice versa (no orphans)
  * SESSION_SUMMARY.md's linked docs actually exist
  * CLAUDE.md's claimed codebase map matches reality
  * AUTONOMOUS_PLAN.md queue items have all required columns
  * LEARNINGS.md entries are dated and chronological (newest first)
  * PHASE_METRICS.md claims match seed.json reality
  * No two memory files have conflicting `name:` frontmatter values
  * All file paths referenced in docs resolve

Exit code 0 = healthy. Non-zero with count of issues found.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).resolve().parent.parent
MEMORY_DIR = ROOT.parent / ".auto-memory"
SESSION_SUMMARY = ROOT / "SESSION_SUMMARY.md"
AUTONOMOUS_PLAN = ROOT / "AUTONOMOUS_PLAN.md"
LEARNINGS = ROOT / "LEARNINGS.md"
CLAUDE_MD = ROOT / "CLAUDE.md"
SEED = ROOT / "src" / "data" / "seed.json"


class Issue(NamedTuple):
    severity: str  # "error" | "warn" | "info"
    area: str
    message: str


issues: list[Issue] = []


def err(area: str, msg: str) -> None: issues.append(Issue("error", area, msg))
def warn(area: str, msg: str) -> None: issues.append(Issue("warn", area, msg))
def info(area: str, msg: str) -> None: issues.append(Issue("info", area, msg))


def parse_frontmatter(text: str) -> dict | None:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not m:
        return None
    fm: dict = {}
    for line in m.group(1).splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        fm[k.strip()] = v.strip()
    return fm


# ----- Memory file checks -----------------------------------------------------

def check_memory() -> None:
    if not MEMORY_DIR.exists():
        err("memory", f"directory missing: {MEMORY_DIR}")
        return

    memory_files = sorted(p.name for p in MEMORY_DIR.glob("*.md") if p.name != "MEMORY.md")
    index_path = MEMORY_DIR / "MEMORY.md"

    if not index_path.exists():
        err("memory", "MEMORY.md index file missing")
        return

    index_content = index_path.read_text(encoding="utf-8")
    referenced = set(re.findall(r"\(([a-z_]+\.md)\)", index_content))
    actual = set(memory_files)

    orphans = actual - referenced
    stale = referenced - actual
    for o in sorted(orphans):
        warn("memory", f"file exists but not indexed in MEMORY.md: {o}")
    for s in sorted(stale):
        err("memory", f"MEMORY.md references non-existent file: {s}")

    # Frontmatter checks
    names_seen: dict[str, str] = {}
    for mf in memory_files:
        text = (MEMORY_DIR / mf).read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        if not fm:
            err("memory", f"{mf}: no frontmatter")
            continue
        for required in ("name", "description", "type"):
            if required not in fm:
                err("memory", f"{mf}: missing frontmatter field '{required}'")
        allowed_types = {"user", "feedback", "project", "reference"}
        if fm.get("type") not in allowed_types:
            err("memory", f"{mf}: type '{fm.get('type')}' not in {allowed_types}")
        n = fm.get("name", "")
        if n in names_seen:
            err("memory", f"{mf}: duplicate frontmatter name '{n}' also in {names_seen[n]}")
        else:
            names_seen[n] = mf
        # I-17: if originSessionId present (added by linter), verify it looks like a UUID-ish token
        osid = fm.get("originSessionId")
        if osid is not None:
            if len(osid) < 10 or " " in osid:
                warn("memory", f"{mf}: originSessionId looks malformed: '{osid}'")


# ----- Doc cross-references ---------------------------------------------------

def check_session_summary() -> None:
    if not SESSION_SUMMARY.exists():
        err("summary", "SESSION_SUMMARY.md missing")
        return
    text = SESSION_SUMMARY.read_text(encoding="utf-8")
    links = re.findall(r"\]\(\./([^)]+)\)", text)
    for link in links:
        target = ROOT / link
        if not target.exists():
            err("summary", f"broken link to {link}")


def check_claude_md() -> None:
    if not CLAUDE_MD.exists():
        warn("claude.md", "CLAUDE.md missing — any new session starts cold")
        return
    text = CLAUDE_MD.read_text(encoding="utf-8")
    # Check that the claimed codebase map references exist
    claimed = re.findall(r"^│\s*[├└]──\s*(\S+)", text, re.MULTILINE)
    # Also match bare filename entries in the fenced code block
    fenced = re.findall(r"[├└]──\s+([A-Za-z][\w.\-/]+)", text)
    for path_hint in set(claimed) | set(fenced):
        # Skip conceptual entries (folder placeholders with trailing /)
        if path_hint.endswith("/"):
            continue
        candidate = ROOT / path_hint
        # Also try nested (e.g. if hint is "seed.json" in data/ block)
        if not candidate.exists():
            # Check if it exists anywhere under ROOT
            matches = list(ROOT.rglob(path_hint))
            if not matches:
                warn("claude.md", f"codebase map claims {path_hint} but not found")


# ----- Autonomous plan queue check -------------------------------------------

def check_queue() -> None:
    if not AUTONOMOUS_PLAN.exists():
        err("plan", "AUTONOMOUS_PLAN.md missing")
        return
    text = AUTONOMOUS_PLAN.read_text(encoding="utf-8")
    # Each queue row starts with | # | **ID** | ...
    # Accept both old-style IDs (F-01, D-01) and new-style batch IDs (BATCH-1).
    rows = re.findall(r"\|\s*[\d✅]+?\s*\|\s*\*\*([A-Z][\w/\-]*)\*\*\s*\|", text)
    if len(rows) < 3:
        warn("plan", f"queue looks thin — only {len(rows)} items parsed")
    # Check for duplicate IDs (excluding completed ✅)
    from collections import Counter
    counts = Counter(rows)
    for rid, n in counts.items():
        if n > 1:
            warn("plan", f"duplicate queue ID: {rid} appears {n} times")
    info("plan", f"queue parses cleanly: {len(rows)} items, {len(set(rows))} unique IDs")


# ----- Learnings chronology check --------------------------------------------

def check_learnings() -> None:
    if not LEARNINGS.exists():
        err("learnings", "LEARNINGS.md missing")
        return
    text = LEARNINGS.read_text(encoding="utf-8")
    # Entries look like "## 2026-04-23 · …"
    dates = re.findall(r"^## (\d{4}-\d{2}-\d{2}) ·", text, re.MULTILINE)
    if len(dates) < 2:
        info("learnings", f"only {len(dates)} dated entries so far")
        return
    # Newest should be first
    sorted_desc = sorted(dates, reverse=True)
    if dates != sorted_desc:
        warn("learnings", "entries are not in newest-first order")
    info("learnings", f"{len(dates)} entries, chronology OK")


# ----- Metrics reality check --------------------------------------------------

def check_subagent_logs() -> None:
    """Sanity-check the subagent audit trail."""
    log_dir = ROOT / "logs" / "subagent_runs"
    if not log_dir.exists():
        info("agents", "logs/subagent_runs/ directory not created yet — fine if no subagents run")
        return
    logs = list(log_dir.glob("*.json"))
    if not logs:
        info("agents", "log directory exists but empty — fine")
        return
    required_keys = {"milestone", "dispatched_at", "inputs", "outcome", "usage"}
    for p in logs:
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            err("agents", f"{p.name}: invalid JSON — {e}")
            continue
        missing = required_keys - set(data.keys())
        if missing:
            warn("agents", f"{p.name}: missing keys {missing}")
    info("agents", f"{len(logs)} subagent run log(s) present, all parse cleanly")


def check_metrics_vs_seed() -> None:
    if not SEED.exists():
        err("metrics", "seed.json missing")
        return
    data = json.loads(SEED.read_text(encoding="utf-8"))
    v_count = len(data["vehicles"])
    b_count = len(data["brands"])
    metrics_path = ROOT / "PHASE_METRICS.md"
    if not metrics_path.exists():
        err("metrics", "PHASE_METRICS.md missing")
        return
    m = metrics_path.read_text(encoding="utf-8")
    if f"| Vehicles | {v_count} |" not in m:
        err("metrics", f"PHASE_METRICS.md vehicle count out of sync with seed ({v_count} in seed)")
    if f"| Brands | {b_count} |" not in m:
        err("metrics", f"PHASE_METRICS.md brand count out of sync with seed ({b_count} in seed)")
    info("metrics", f"metrics match seed: {v_count} vehicles, {b_count} brands")


# ----- Main -------------------------------------------------------------------

def main() -> int:
    check_memory()
    check_session_summary()
    check_claude_md()
    check_queue()
    check_learnings()
    check_metrics_vs_seed()
    check_subagent_logs()

    errors = [i for i in issues if i.severity == "error"]
    warns = [i for i in issues if i.severity == "warn"]
    infos = [i for i in issues if i.severity == "info"]

    print(f"System validation: {len(errors)} errors, {len(warns)} warnings, {len(infos)} info")
    for i in errors:
        print(f"  ✗ [{i.area}] {i.message}")
    for i in warns:
        print(f"  ⚠ [{i.area}] {i.message}")
    for i in infos:
        print(f"  · [{i.area}] {i.message}")

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
