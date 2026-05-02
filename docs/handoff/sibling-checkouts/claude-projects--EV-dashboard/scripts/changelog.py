#!/usr/bin/env python3
"""
Generate CHANGELOG.md from LEARNINGS.md milestone entries.

Each milestone closure in LEARNINGS becomes a CHANGELOG row grouped by date,
with a terse one-line summary. Intended for a human skim, not for machine
consumption — complements the detailed prose in LEARNINGS.md.

Usage:
    python3 scripts/changelog.py > CHANGELOG.md   (or just) python3 scripts/changelog.py
"""

from __future__ import annotations

import re
import sys
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEARNINGS = ROOT / "LEARNINGS.md"
OUT = ROOT / "CHANGELOG.md"


def first_sentence(text: str, max_len: int = 160) -> str:
    # Split on the first period followed by space; fall back to newline.
    text = text.strip().replace("\n", " ")
    m = re.split(r"(?<=[.!?])\s", text, maxsplit=1)
    out = (m[0] if m else text)[:max_len]
    return out.rstrip()


def main() -> int:
    if not LEARNINGS.exists():
        sys.stderr.write("LEARNINGS.md not found\n")
        return 1

    text = LEARNINGS.read_text(encoding="utf-8")
    # Match "## YYYY-MM-DD · <title>\n\n<body until next ## or EOF>"
    pattern = re.compile(
        r"^##\s+(\d{4}-\d{2}-\d{2})\s*·\s*(.+?)\n\n(.*?)(?=\n## |\Z)",
        re.DOTALL | re.MULTILINE,
    )
    by_date: OrderedDict[str, list[tuple[str, str]]] = OrderedDict()
    for m in pattern.finditer(text):
        date, title, body = m.group(1), m.group(2).strip(), m.group(3).strip()
        by_date.setdefault(date, []).append((title, first_sentence(body)))

    lines = [
        "# CHANGELOG",
        "",
        "*Auto-generated from `LEARNINGS.md` via `scripts/changelog.py`.*",
        "*Each row is one milestone close or batch retrospective. Full detail in LEARNINGS.*",
        "",
    ]
    for date in sorted(by_date.keys(), reverse=True):
        lines.append(f"## {date}")
        lines.append("")
        for title, summary in by_date[date]:
            lines.append(f"- **{title}** — {summary}")
        lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT} · {sum(len(v) for v in by_date.values())} entries across {len(by_date)} dates")
    return 0


if __name__ == "__main__":
    sys.exit(main())
