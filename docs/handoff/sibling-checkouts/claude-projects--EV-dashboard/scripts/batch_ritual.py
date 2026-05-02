#!/usr/bin/env python3
"""
Inter-batch ritual — the deeper validation + cleanup + learnings pass that runs
after every batch closes. Heavier than per-milestone milestone.py; lighter than
a full audit. Designed to be cheap enough to run after every batch without
fatigue, but thorough enough to catch bloat, stale docs, and drift that the
per-milestone gate misses.

Pipeline:
    1. Deep validation   — metrics, system validator, thermal anchors, integrity
    2. Bloat audit       — any doc > N lines? scripts > M lines? dead code?
    3. Snapshot rotation — keep the most recent N snapshots, archive older
    4. Subagent log review — prompt versions, improvements_for_next_run summary
    5. Memory pass       — scan .auto-memory/ for duplicates, stale refs
    6. Learnings summary — append a "Batch X retrospective" block
    7. Batch index       — update BATCH_PLAN.md with the batch's close state
    8. Token economy     — rough estimate of context needed to resume

Usage:
    python3 scripts/batch_ritual.py <batch_id> "<one-line retrospective>"
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEM_DIR = ROOT.parent / ".auto-memory"
SNAP_DIR = ROOT / "snapshots"
LEARNINGS = ROOT / "LEARNINGS.md"
BATCH_PLAN = ROOT / "BATCH_PLAN.md"
AGENT_LOGS = ROOT / "logs" / "subagent_runs"

SNAPSHOT_KEEP = 15      # keep last N snapshots; archive older
DOC_LINE_WARN = 800     # warn when a doc exceeds this many lines
SCRIPT_LINE_WARN = 400  # warn when a script exceeds this many lines


def rule(title: str) -> None:
    print()
    print(f"━━━━ {title} ━━━━")


def run(script: str) -> int:
    return subprocess.call([sys.executable, str(ROOT / "scripts" / script)])


# ----- 1. Deep validation -----------------------------------------------------

def deep_validation() -> bool:
    rule("1/8 Deep validation")
    ok = True
    for s in ("metrics.py", "validate_system.py", "validate_thermal.py"):
        rc = run(s)
        if rc != 0:
            ok = False
            print(f"  ✗ {s} failed")
    return ok


# ----- 2. Bloat audit ---------------------------------------------------------

def bloat_audit() -> list[str]:
    rule("2/8 Bloat audit")
    findings: list[str] = []
    for md in ROOT.glob("*.md"):
        lines = sum(1 for _ in md.open(encoding="utf-8"))
        if lines > DOC_LINE_WARN:
            findings.append(f"{md.name}: {lines} lines (consider trimming)")
    for py in ROOT.glob("scripts/*.py"):
        lines = sum(1 for _ in py.open(encoding="utf-8"))
        if lines > SCRIPT_LINE_WARN:
            findings.append(f"scripts/{py.name}: {lines} lines (consider splitting)")
    if not findings:
        print("  ✓ no docs or scripts over threshold")
    else:
        for f in findings:
            print(f"  ⚠ {f}")
    return findings


# ----- 3. Snapshot rotation ---------------------------------------------------

def rotate_snapshots() -> int:
    rule("3/8 Snapshot rotation")
    if not SNAP_DIR.exists():
        print("  · no snapshots yet")
        return 0
    snaps = sorted(SNAP_DIR.glob("*-seed.json"))
    removed = 0
    if len(snaps) > SNAPSHOT_KEEP:
        archive_dir = SNAP_DIR / "archive"
        archive_dir.mkdir(exist_ok=True)
        for old in snaps[: -SNAPSHOT_KEEP]:
            old.rename(archive_dir / old.name)
            removed += 1
    print(f"  ✓ {len(snaps) - removed} active snapshots, {removed} archived")
    return removed


# ----- 4. Subagent log review -------------------------------------------------

def review_agent_logs() -> dict:
    rule("4/8 Subagent log review")
    if not AGENT_LOGS.exists():
        print("  · no agent logs directory yet")
        return {}
    stats = {"runs": 0, "total_tokens": 0, "prompt_versions": Counter()}
    improvements: list[str] = []
    for p in sorted(AGENT_LOGS.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        stats["runs"] += 1
        stats["total_tokens"] += data.get("usage", {}).get("tokens_total", 0)
        stats["prompt_versions"][data.get("prompt_version", "?")] += 1
        for imp in data.get("improvements_for_next_run", []):
            improvements.append(f"{p.stem}: {imp}")
    print(f"  ✓ {stats['runs']} runs · {stats['total_tokens']:,} cumulative tokens")
    print(f"    prompt versions: {dict(stats['prompt_versions'])}")
    if improvements:
        print(f"    improvements carry-forward ({len(improvements)}):")
        for imp in improvements[-3:]:
            print(f"      · {imp}")
    return stats


# ----- 5. Memory pass ---------------------------------------------------------

def memory_pass() -> list[str]:
    rule("5/8 Memory pass")
    if not MEM_DIR.exists():
        print("  · no .auto-memory directory")
        return []
    issues: list[str] = []
    # Collect frontmatter names to find semantic duplicates.
    names = {}
    for mf in MEM_DIR.glob("*.md"):
        if mf.name == "MEMORY.md":
            continue
        text = mf.read_text(encoding="utf-8")
        m = re.search(r"^name:\s*(.+)$", text, re.MULTILINE)
        if m:
            key = m.group(1).strip().lower()
            if key in names:
                issues.append(f"Possible semantic duplicate: '{m.group(1)}' in {mf.name} and {names[key]}")
            names[key] = mf.name
    if not issues:
        print(f"  ✓ {len(names)} memory entries, no duplicate names")
    else:
        for i in issues:
            print(f"  ⚠ {i}")
    return issues


# ----- 6. Learnings summary ---------------------------------------------------

def append_batch_retrospective(batch_id: str, note: str) -> None:
    rule("6/8 Learnings retrospective")
    today = date.today().isoformat()
    block = (
        f"\n## {today} · Batch {batch_id} retrospective 📊\n\n"
        f"{note}\n\n"
        f"*Auto-appended by batch_ritual.py at batch close. Edit freely.*\n"
    )
    text = LEARNINGS.read_text(encoding="utf-8")
    if "---\n" in text:
        head, rest = text.split("---\n", 1)
        LEARNINGS.write_text(head + "---\n" + block + rest, encoding="utf-8")
    else:
        LEARNINGS.write_text(text + block, encoding="utf-8")
    print(f"  ✓ batch retrospective appended to LEARNINGS.md")


# ----- 7. Batch-plan update ---------------------------------------------------

def update_batch_plan(batch_id: str) -> None:
    rule("7/8 Batch-plan index update")
    if not BATCH_PLAN.exists():
        print("  · no BATCH_PLAN.md")
        return
    text = BATCH_PLAN.read_text(encoding="utf-8")
    # Flip "## Batch N — ..." heading to add ✅ if not already marked.
    norm_id = batch_id.replace("BATCH-", "")  # accept BATCH-1 or 1
    pattern = rf"^(## Batch {norm_id} — [^\n]+)(?! ✅)$"
    new = re.sub(pattern, r"\1 ✅", text, count=1, flags=re.MULTILINE)
    if new != text:
        BATCH_PLAN.write_text(new, encoding="utf-8")
        print(f"  ✓ BATCH_PLAN.md: marked Batch {norm_id} done")
    else:
        print(f"  · BATCH_PLAN.md: Batch {norm_id} heading already marked or not found")


# ----- 8. Token economy estimate ---------------------------------------------

def token_economy() -> None:
    rule("8/8 Token economy — resume-cost estimate + ROI dashboard")
    # Rough proxy: count total chars in the three "always-loaded" docs.
    size_estimate = 0
    for p in ("CLAUDE.md", "SESSION_SUMMARY.md", "BATCH_PLAN.md"):
        path = ROOT / p
        if path.exists():
            size_estimate += path.stat().st_size
    # Rule of thumb: ~4 chars per token.
    est_tokens = size_estimate // 4
    print(f"  · combined size of primary docs: {size_estimate:,} bytes")
    print(f"  · rough tokens to resume cold (CLAUDE + SUMMARY + BATCH_PLAN): ~{est_tokens:,}")
    if est_tokens > 15_000:
        print(f"  ⚠ primary-doc corpus is getting heavy — consider trimming")

    # Chain into the full ROI dashboard so the batch close has a complete picture.
    print()
    subprocess.call([sys.executable, str(ROOT / "scripts" / "token_roi.py"), "dashboard"])


# ----- Main -------------------------------------------------------------------

def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("Usage: python3 scripts/batch_ritual.py <batch_id> \"<one-line retrospective>\"")
        return 2
    batch_id = argv[1]
    note = argv[2]

    print(f"Inter-batch ritual: {batch_id} · {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Retrospective: {note}")

    if not deep_validation():
        print("\n✗ Deep validation failed — fix before closing batch.")
        return 1

    bloat_audit()
    rotate_snapshots()
    review_agent_logs()
    memory_pass()
    append_batch_retrospective(batch_id, note)
    update_batch_plan(batch_id)
    token_economy()

    print()
    print("✅ Inter-batch ritual complete.")
    print(f"   Next: pick next batch from BATCH_PLAN.md or run `kickoff.py`")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
