#!/usr/bin/env python3
"""research_vehicle.py — emit a parallel-dispatch research plan for one vehicle.

Usage:
    python3 scripts/research_vehicle.py "Brand Model Year [Trim]"
    python3 scripts/research_vehicle.py "Hyundai Kona Electric 2024 Long Range"
    python3 scripts/research_vehicle.py "Volvo EX30 2025"  --output docs/research/auto/

Why this exists. The single most expensive recurring research task is "add a new
vehicle to seed.json". Every entry needs ~20 fields each backed by a citation.
Done serially with WebSearch, that is 60+ tool calls and an hour of wall clock.

What this script does. It does NOT make network calls. It emits a structured
parallel-dispatch plan as a markdown checklist + a JSON spec the agent
orchestrator can hand directly to N parallel sub-agents. The agent reads the
plan, fans out, and reassembles the result.

The plan is deliberately structured so the parallel sub-agents do not overlap:
each agent owns a disjoint set of fields with a primary source assignment and a
fallback path.

Output:
    docs/research/auto/<slug>-<date>.md   — the human-readable plan + result template
    docs/research/auto/<slug>-<date>.json — the machine-readable dispatch spec
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Source matrix — primary + fallback URLs / search shapes per field group.
# ---------------------------------------------------------------------------

# Each block is (group_name, fields, primary_strategy, fallback_strategy).
# A "strategy" is a dict the agent uses to construct queries / URLs.
GROUPS: list[dict] = [
    {
        "name": "battery_and_chemistry",
        "fields": ["battery_kwh_total", "battery_kwh_usable", "battery_chemistry"],
        "primary": {
            "tool": "web_fetch",
            "url_template": "https://ev-database.org/?search=1&q={brand}+{model}",
            "extract": "Pick the trim row matching the year+trim. Pull total + usable kWh and chemistry (NMC/LFP/NCA).",
        },
        "fallback": [
            {"tool": "web_search", "query": "{brand} {model} {year} battery kWh total usable chemistry"},
            {"tool": "web_fetch", "url_template": "https://insideevs.com/?s={brand}+{model}+{year}", "extract": "battery"},
        ],
    },
    {
        "name": "range_and_protocol",
        "fields": ["range_km", "range_protocol"],
        "primary": {
            "tool": "web_fetch",
            "url_template": "https://www.fueleconomy.gov/feg/PowerSearch.do?action=noform&path=1&year1={year}&year2={year}&make={brand}",
            "extract": "Find the matching trim. Convert miles → km if needed. Note whether protocol is EPA or WLTP.",
        },
        "fallback": [
            {"tool": "web_search", "query": "{brand} {model} {year} EPA range miles km Canada"},
        ],
    },
    {
        "name": "charging",
        "fields": ["ac_charge_kw_max", "dc_charge_kw_max", "port_type", "charging_curve_20c"],
        "primary": {
            "tool": "web_fetch",
            "url_template": "https://ev-database.org/?search=1&q={brand}+{model}",
            "extract": "AC max (standard onboard charger), DC peak kW, port type (CCS1/NACS/CCS2). Curve from EVKX.net or Fastned if available.",
        },
        "fallback": [
            {"tool": "web_search", "query": "{brand} {model} {year} DC fast charging speed kW peak curve"},
            {"tool": "web_fetch", "url_template": "https://evkx.net/models/{brand}/", "extract": "charging curve"},
        ],
    },
    {
        "name": "thermal",
        "fields": [
            "has_heat_pump",
            "thermal_management",
            "cold_derate_curve",
            "hvac_draw_kw_by_temp",
            "hp_min_temp_c",
            "precon_time_by_temp",
            "precon_thermal_gain",
            "dc_cold_soak_curve",
        ],
        "primary": {
            "tool": "web_search",
            "query": "{brand} {model} heat pump cold weather range loss Bjorn Nyland Recurrent",
            "extract": "Determine: heat pump yes/no. Model class peer for cold-derate curve (NMC vs LFP). Use peer's curve as starting point.",
        },
        "fallback": [
            {"tool": "web_fetch", "url_template": "https://www.recurrentauto.com/research/winter-ev-range-loss", "extract": "model peer"},
            {"tool": "web_fetch", "url_template": "https://support.fastned.nl/hc/en-gb/articles/360007516494", "extract": "cold-soak curve"},
        ],
    },
    {
        "name": "physical",
        "fields": ["seats", "cargo_l_seats_up", "cargo_l_seats_down", "tow_rating_kg", "weight_kg", "body_style"],
        "primary": {
            "tool": "web_fetch",
            "url_template": "https://www.{brand_lower}.ca/en/models/{model_slug}.html",
            "extract": "OEM Canadian spec sheet — body style, seats, cargo L (seats up + down), curb weight kg, tow rating kg.",
        },
        "fallback": [
            {"tool": "web_search", "query": "{brand} {model} {year} cargo litres curb weight kg tow rating Canada"},
        ],
    },
    {
        "name": "pricing_and_rebates",
        "fields": ["msrp_cad", "federal_izev_cad", "provincial_rebate_cad_on"],
        "primary": {
            "tool": "web_search",
            "query": "{brand} {model} {year} Canada MSRP CAD price trim",
            "extract": "Use the trim's CAD MSRP. iZEV: paused as of 2026 → 0. Ontario provincial rebate: none → 0.",
        },
        "fallback": [
            {"tool": "web_fetch", "url_template": "https://www.autotrader.ca/research/{brand_lower}/{model_lower}/{year}/", "extract": "trim MSRP"},
            {"tool": "web_search", "query": "iZEV program status 2026 Canada"},
        ],
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(s: str) -> str:
    out = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return out or "vehicle"


def expand(template: str, ctx: dict) -> str:
    return template.format(**ctx)


def build_dispatch_spec(brand: str, model: str, year: int, trim: str | None) -> dict:
    ctx = {
        "brand": brand,
        "brand_lower": slugify(brand),
        "model": model,
        "model_lower": slugify(model),
        "model_slug": slugify(model),
        "year": year,
        "trim": trim or "",
    }

    plan: list[dict] = []
    for g in GROUPS:
        primary = dict(g["primary"])
        if "url_template" in primary:
            primary["url"] = expand(primary["url_template"], ctx)
        if "query" in primary:
            primary["query"] = expand(primary["query"], ctx)

        fbs = []
        for fb in g.get("fallback", []):
            fb = dict(fb)
            if "url_template" in fb:
                fb["url"] = expand(fb["url_template"], ctx)
            if "query" in fb:
                fb["query"] = expand(fb["query"], ctx)
            fbs.append(fb)

        plan.append(
            {
                "agent_id": g["name"],
                "fields": g["fields"],
                "primary": primary,
                "fallback": fbs,
            }
        )

    return {
        "vehicle": {"brand": brand, "model": model, "year": year, "trim": trim},
        "agents": plan,
        "instruction_to_orchestrator": (
            "Spawn one general-purpose Agent per agent_id, ALL IN A SINGLE TOOL "
            "MESSAGE so they run in parallel. Each agent fetches the primary URL "
            "or runs the primary search, extracts only the listed fields, and "
            "returns a JSON object with {field_name: {value, confidence (H/M/L), "
            "source_url, source_name, accessed (today)}}. If primary fails, the "
            "agent tries fallbacks in order before reporting Low confidence with "
            "a 'data not located' note. The orchestrator (me) merges the JSON "
            "blobs into the seed.json schema."
        ),
    }


def build_markdown(spec: dict) -> str:
    v = spec["vehicle"]
    title = f"{v['brand']} {v['model']} {v['year']}"
    if v["trim"]:
        title += f" {v['trim']}"

    lines: list[str] = []
    lines.append(f"# Vehicle research plan — {title}")
    lines.append("")
    lines.append(f"*Generated by `scripts/research_vehicle.py` on {date.today().isoformat()}.*")
    lines.append("")
    lines.append("**Goal.** Pull the full set of seed.json fields for this vehicle in one parallel sweep.")
    lines.append("")
    lines.append("**How to execute.** Send ONE tool message with all of these `Agent` calls in parallel. "
                 "Each agent owns its disjoint set of fields. Total wall-clock = slowest agent.")
    lines.append("")
    lines.append("---")
    lines.append("")
    for a in spec["agents"]:
        lines.append(f"## Agent: `{a['agent_id']}`")
        lines.append("")
        lines.append("**Fields owned:** " + ", ".join(f"`{f}`" for f in a["fields"]))
        lines.append("")
        p = a["primary"]
        lines.append(f"**Primary tool:** `{p['tool']}`")
        if "url" in p:
            lines.append(f"- URL: `{p['url']}`")
        if "query" in p:
            lines.append(f"- Query: `{p['query']}`")
        if "extract" in p:
            lines.append(f"- Extract: {p['extract']}")
        if a["fallback"]:
            lines.append("")
            lines.append("**Fallbacks (in order):**")
            for fb in a["fallback"]:
                desc = f"- `{fb['tool']}`"
                if "url" in fb:
                    desc += f" — URL `{fb['url']}`"
                if "query" in fb:
                    desc += f" — query `{fb['query']}`"
                if "extract" in fb:
                    desc += f" — {fb['extract']}"
                lines.append(desc)
        lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Result template")
    lines.append("")
    lines.append("Each agent returns JSON like:")
    lines.append("")
    lines.append("```json")
    lines.append("{")
    lines.append('  "battery_kwh_usable": {')
    lines.append('    "value": 77.0,')
    lines.append('    "confidence": "High",')
    lines.append('    "source": {"url": "...", "name": "...", "accessed": "2026-04-24"},')
    lines.append('    "notes": "optional"')
    lines.append("  }")
    lines.append("}")
    lines.append("```")
    lines.append("")
    lines.append("Orchestrator merges and writes the seed.json entry.")
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("query", help='e.g. "Hyundai Kona Electric 2024 Long Range"')
    ap.add_argument("--output", default="docs/research/auto/")
    args = ap.parse_args(argv[1:])

    parts = args.query.split()
    if len(parts) < 3:
        print("Need at least: <Brand> <Model> <Year>", file=sys.stderr)
        return 2
    # Find a 4-digit year in the parts
    year = None
    year_idx = -1
    for i, p in enumerate(parts):
        if re.fullmatch(r"20\d{2}", p):
            year = int(p)
            year_idx = i
            break
    if year is None:
        print("No 4-digit year found in input", file=sys.stderr)
        return 2

    brand = parts[0]
    model = " ".join(parts[1:year_idx])
    trim = " ".join(parts[year_idx + 1 :]) or None

    spec = build_dispatch_spec(brand, model, year, trim)
    md = build_markdown(spec)

    out_dir = ROOT / args.output
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = slugify(f"{brand}-{model}-{year}")
    md_path = out_dir / f"{slug}-{date.today().isoformat()}.md"
    json_path = out_dir / f"{slug}-{date.today().isoformat()}.json"
    md_path.write_text(md, encoding="utf-8")
    json_path.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")

    print(f"plan: {md_path.relative_to(ROOT)}")
    print(f"spec: {json_path.relative_to(ROOT)}")
    print()
    print(f"agents to spawn in parallel: {len(spec['agents'])}")
    for a in spec["agents"]:
        print(f"  - {a['agent_id']:<25}  fields={len(a['fields'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
