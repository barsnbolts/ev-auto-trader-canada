#!/usr/bin/env python3
"""
Regenerate PHASE_METRICS.md from the authoritative source data.

Design principle: the self-learning layer must never drift from reality.
Phase metrics cannot be hand-edited — running this script is the only
legitimate way to update PHASE_METRICS.md.

Usage:
    python3 scripts/metrics.py

Reads:   src/data/seed.json
Writes:  PHASE_METRICS.md
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src" / "data" / "seed.json"
OUT = ROOT / "PHASE_METRICS.md"


def count_src_lines(glob: str) -> int:
    total = 0
    for path in ROOT.glob(glob):
        if path.is_file():
            with path.open("r", encoding="utf-8") as fh:
                total += sum(1 for _ in fh)
    return total


def check_seed_integrity(vehicles: list[dict]) -> list[str]:
    """Return a list of data quality issues, empty list means all clean."""
    issues: list[str] = []
    cited_fields = [
        "range_km", "battery_kwh_usable", "dc_charge_kw_max",
        "ac_charge_kw_max", "msrp_cad", "has_heat_pump",
    ]
    for v in vehicles:
        for field in cited_fields:
            cv = v.get(field) or {}
            # A non-Low vehicle with a null value is a data integrity issue.
            if cv.get("value") is None and v.get("overall_confidence") != "Low":
                issues.append(f"{v['id']}.{field}: value is null but vehicle is not Low-confidence")
    return issues


def main() -> int:
    if not SEED.exists():
        sys.stderr.write(f"seed not found at {SEED}\n")
        return 1

    data = json.loads(SEED.read_text(encoding="utf-8"))
    vehicles = data["vehicles"]
    brands = data["brands"]

    powertrain = Counter(v["powertrain"] for v in vehicles)
    body = Counter(v["body_style"] for v in vehicles)
    drive = Counter(v["drivetrain_variant"] for v in vehicles)
    conf = Counter(v["overall_confidence"] for v in vehicles)

    issues = check_seed_integrity(vehicles)

    ts_lines = count_src_lines("src/**/*.ts") + count_src_lines("src/**/*.tsx")
    json_lines = count_src_lines("src/data/*.json")

    def row(label: str, val: int | str) -> str:
        return f"| {label} | {val} |"

    lines: list[str] = []
    lines.append("# Phase metrics (auto-generated)")
    lines.append("")
    lines.append(f"*Generated {date.today().isoformat()} by `scripts/metrics.py`. Do not hand-edit.*")
    lines.append("")
    lines.append("## Code")
    lines.append("| Metric | Value |")
    lines.append("|---|---|")
    lines.append(row("Lines of TypeScript/TSX (src/)", ts_lines))
    lines.append(row("Lines of seed JSON", json_lines))
    lines.append("")
    lines.append("## Data coverage")
    lines.append("| Metric | Count |")
    lines.append("|---|---|")
    lines.append(row("Brands", len(brands)))
    lines.append(row("Vehicles", len(vehicles)))
    for k in sorted(powertrain): lines.append(row(f"Powertrain: {k}", powertrain[k]))
    for k in sorted(body):       lines.append(row(f"Body style: {k}", body[k]))
    for k in sorted(drive):      lines.append(row(f"Drivetrain: {k}", drive[k]))
    for k in ["High", "Medium", "Low"]:
        lines.append(row(f"Confidence: {k}", conf.get(k, 0)))
    lines.append("")
    lines.append("## Data integrity checks")
    if issues:
        lines.append(f"**{len(issues)} issue(s) found:**")
        lines.append("")
        for issue in issues:
            lines.append(f"- ⚠️ {issue}")
    else:
        lines.append("✅ All non-Low vehicles have values in every required field.")
    lines.append("")
    lines.append("## Milestone readiness")
    lines.append("- ✅ Phase 1 MVP (scaffold + seed + compare view)")
    lines.append("- ✅ Phase 1 visual validation via Claude-in-Chrome")
    lines.append("- 🟡 Thermal physics model written, not yet wired to UI → Milestone 3b")
    lines.append("- ⬜ Data-quality validator script → Milestone 2a (this is part of it)")
    lines.append("- ⬜ Exa-powered verification pass → Milestone 2b")
    lines.append("")
    lines.append("## How to regenerate")
    lines.append("```")
    lines.append("python3 scripts/metrics.py")
    lines.append("```")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT} ({len(vehicles)} vehicles, {len(issues)} integrity issues)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
