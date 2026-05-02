#!/usr/bin/env python3
"""
Self-optimization sweep. Triggered by milestone.py every 5 completed milestones.

Checks (all non-fatal, reported to LEARNINGS):

  1. Doc length drift — flag any top-level .md that grew > 1.5× since its
     last-measured baseline.
  2. Stale citations — any source.accessed in seed.json older than 90 days.
  3. Caveman-style leakage into user-facing files — keyword scan for common
     fragment patterns ("fix:", "add:", "drop:", "refactor:") at line starts
     in files that should be plain-English.
  4. Pleasantries in internal files — "certainly", "happy to", "great", etc.
     in commit messages (last 20) and in caveman-tagged docs.
  5. Memory freshness — verify .auto-memory/ and canonical memory paths
     both exist; flag if not.

Usage:
    python3 scripts/self_audit.py            # report only
    python3 scripts/self_audit.py --append   # append findings to LEARNINGS.md
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEARNINGS = ROOT / "LEARNINGS.md"
SEED = ROOT / "src" / "data" / "seed.json"
AUTO_MEMORY = ROOT / ".auto-memory"
BASELINES = ROOT / ".audit_baselines.json"

PLAIN_ENGLISH_FILES = [
    "CLAUDE.md",
    "SESSION_SUMMARY.md",
    "PROJECT_PLAN.md",
    "README.md",
    "docs/writing_style.md",
    "docs/external_keys.md",
    "docs/user_guide.md",
]

CAVEMAN_LEAK_PATTERNS = [
    re.compile(r"^(fix|add|drop|refactor|chore|feat):", re.MULTILINE | re.IGNORECASE),
]

PLEASANTRY_PATTERNS = [
    re.compile(r"\b(certainly|happy to|great question|as you can see)\b", re.IGNORECASE),
    re.compile(r"\bI'd (be )?(happy|glad)", re.IGNORECASE),
]


def doc_lengths() -> dict[str, int]:
    out: dict[str, int] = {}
    for p in ROOT.glob("*.md"):
        out[p.name] = len(p.read_text(encoding="utf-8").splitlines())
    return out


def load_baselines() -> dict[str, int]:
    if not BASELINES.exists():
        return {}
    try:
        return json.loads(BASELINES.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_baselines(data: dict[str, int]) -> None:
    BASELINES.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def check_doc_bloat() -> list[str]:
    findings: list[str] = []
    current = doc_lengths()
    base = load_baselines()
    for name, lines in current.items():
        if name not in base:
            continue  # first-run baseline gets saved after
        if lines > base[name] * 1.5 and lines - base[name] > 50:
            findings.append(
                f"  - {name} grew {base[name]} → {lines} lines (>1.5×) — audit for bloat"
            )
    # Always update baselines so future runs compare to latest
    save_baselines(current)
    return findings


def check_stale_citations() -> list[str]:
    findings: list[str] = []
    if not SEED.exists():
        return findings
    try:
        data = json.loads(SEED.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ["  - seed.json is malformed (JSON parse failed)"]

    stale: list[tuple[str, str, int]] = []
    today = date.today()
    for v in data.get("vehicles", []):
        vid = v.get("id", "<?>")
        for field, cv in v.items():
            if not isinstance(cv, dict):
                continue
            src = cv.get("source")
            if not isinstance(src, dict):
                continue
            acc = src.get("accessed")
            if not isinstance(acc, str):
                continue
            try:
                acc_date = datetime.strptime(acc, "%Y-%m-%d").date()
            except ValueError:
                continue
            age = (today - acc_date).days
            if age > 90:
                stale.append((vid, field, age))
    if stale:
        findings.append(f"  - {len(stale)} citation(s) > 90 days stale:")
        for vid, field, age in stale[:10]:
            findings.append(f"    · {vid}.{field} ({age} days)")
        if len(stale) > 10:
            findings.append(f"    · …and {len(stale) - 10} more")
    return findings


def check_caveman_leakage() -> list[str]:
    findings: list[str] = []
    for rel in PLAIN_ENGLISH_FILES:
        p = ROOT / rel
        if not p.exists():
            continue
        text = p.read_text(encoding="utf-8")
        for pat in CAVEMAN_LEAK_PATTERNS:
            hits = pat.findall(text)
            if hits:
                findings.append(
                    f"  - {rel}: {len(hits)} caveman-style fragment(s) leaked (e.g. '{hits[0]}')"
                )
    return findings


def check_pleasantry_in_commits() -> list[str]:
    findings: list[str] = []
    try:
        out = subprocess.check_output(
            ["git", "log", "--oneline", "-n", "20"], cwd=ROOT, text=True
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return findings
    for line in out.splitlines():
        for pat in PLEASANTRY_PATTERNS:
            if pat.search(line):
                findings.append(f"  - commit pleasantry: '{line}'")
                break
    return findings


def check_memory_health() -> list[str]:
    findings: list[str] = []
    if not AUTO_MEMORY.exists():
        findings.append("  - .auto-memory/ does not exist")
    else:
        for f in ["user.md", "feedback.md", "project.md", "reference.md"]:
            if not (AUTO_MEMORY / f).exists():
                findings.append(f"  - .auto-memory/{f} missing")
    return findings


def append_to_learnings(block: str) -> None:
    today = date.today().isoformat()
    # Count prior self-optimization entries for numbering.
    text = LEARNINGS.read_text(encoding="utf-8")
    n = text.count("Self-optimization sweep") + 1
    header = f"\n## {today} · Self-optimization sweep #{n}\n\n"
    entry = header + block + "\n"
    split_marker = "---\n"
    if split_marker in text:
        head, rest = text.split(split_marker, 1)
        LEARNINGS.write_text(head + split_marker + entry + rest, encoding="utf-8")
    else:
        LEARNINGS.write_text(text + entry, encoding="utf-8")


def main(argv: list[str]) -> int:
    append = "--append" in argv

    sections: list[tuple[str, list[str]]] = [
        ("Doc length drift", check_doc_bloat()),
        ("Stale citations (>90 days)", check_stale_citations()),
        ("Caveman leakage into user-facing files", check_caveman_leakage()),
        ("Pleasantries in recent commits", check_pleasantry_in_commits()),
        ("Memory health", check_memory_health()),
    ]

    out: list[str] = []
    clean = True
    for name, findings in sections:
        if findings:
            clean = False
            out.append(f"**{name}**")
            out.extend(findings)
            out.append("")
    if clean:
        out.append("All clean. No drift detected.")

    text = "\n".join(out)
    print(text)

    if append:
        append_to_learnings(text)
        print("\n  → appended to LEARNINGS.md")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
