#!/usr/bin/env python3
"""d04_pipeline.py — emit per-vehicle agent prompts + apply results to seed.json.

Reads scripts/d04_list.json. For each vehicle:
  - `--emit-prompt <id>`  → prints a copy-pasteable Agent prompt to stdout
  - `--emit-batch N`      → prints all 5 prompts for batch N (1-indexed)
  - `--apply-batch N`     → runs apply_research.py for every result file in
                            docs/research/auto/d04/ that belongs to batch N
  - `--apply-all`         → run apply_research.py for every result file present
  - `--list`              → list all batches + their vehicles + status

Result files live at:
    docs/research/auto/d04/<vehicle-id>.result.json

Per-vehicle batches: 5 vehicles per batch; ceil(31 / 5) = 7 batches.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIST = ROOT / "scripts" / "d04_list.json"
RESULTS_DIR = ROOT / "docs" / "research" / "auto" / "d04"
APPLY = ROOT / "scripts" / "apply_research.py"

BATCH_SIZE = 5


def load_list() -> list[dict]:
    return json.loads(LIST.read_text(encoding="utf-8"))["vehicles"]


def vehicle_by_id(vid: str) -> dict | None:
    for v in load_list():
        if v["id"] == vid:
            return v
    return None


def batch_for(idx: int) -> int:
    return idx // BATCH_SIZE + 1


def vehicles_in_batch(n: int) -> list[dict]:
    return [v for i, v in enumerate(load_list()) if batch_for(i) == n]


def status_line(v: dict) -> str:
    rf = RESULTS_DIR / f"{v['id']}.result.json"
    return "✓" if rf.exists() else " "


# Default values for fields where we anchor agents
DEFAULTS = {
    "battery_chemistry": "NMC",
    "thermal_management": "active_liquid",
    "degradation_annual": 0.017,
    "powertrain": "BEV",
    "seats": 5,
    "ac_charge_kw_max": 11,
    "port_type": "CCS1",
    "tow_rating_kg_default": None,
}

PROMPT_TEMPLATE = """Execute immediately. Do NOT enter plan mode. Do NOT call ExitPlanMode. Do NOT ask the parent for approval. Use the Exa MCP tools + Write tool directly.

Research the **{year} {brand_display} {model} {trim_hint}** for the EV Dashboard Canadian seed.json. Write ONE JSON file to disk at:

`{result_path}`

Shape (use this exact id + brand_id; fill all numerics from sources, unknown → `null` "Low"):
```json
{{
  "vehicle": {{
    "id": "{id}",
    "brand_id": "{brand_id}",
    "model": "{model}",
    "generation_label": "{generation_label}",
    "year_start": {year_start},
    "year_end": {year_end},
    "powertrain": "BEV",
    "body_style": "{body_style}",
    "drivetrain_variant": "{drivetrain_variant}",
    "trim_label": "{trim_label}",
    "battery_chemistry": "NMC",
    "range_protocol": "EPA",
    "port_type": "{port_type}",
    "seats": {seats},
    "thermal_management": "active_liquid",
    "degradation_annual": 0.017
  }},
  "cited_fields": {{
    "battery_kwh_total": {{"value": ..., "confidence": "...", "source": {{...}}}},
    "battery_kwh_usable": {{"value": ..., "confidence": "...", "source": {{...}}}},
    "range_km": {{"value": ..., "confidence": "...", "source": {{...}}}},
    "ac_charge_kw_max": {{"value": 11, "confidence": "...", "source": {{...}}}},
    "dc_charge_kw_max": {{"value": ..., "confidence": "...", "source": {{...}}}},
    "cargo_l_seats_up": {{"value": ..., "confidence": "...", "source": {{...}}}},
    "cargo_l_seats_down": {{"value": ..., "confidence": "...", "source": {{...}}}},
    "tow_rating_kg": {tow_value_block},
    "weight_kg": {{"value": ..., "confidence": "...", "source": {{...}}}},
    "has_heat_pump": {{"value": true, "confidence": "...", "source": {{...}}}},
    "msrp_cad": {{"value": ..., "confidence": "...", "source": {{...}}}},
    "federal_izev_cad": {{"value": 0, "confidence": "High", "source": {{"url": "https://tc.canada.ca/en/road-transportation/innovative-technologies/zero-emission-vehicles/incentives-zero-emission-vehicles-izev", "name": "Transport Canada — iZEV paused 2026", "accessed": "2026-04-25"}}}},
    "provincial_rebate_cad_on": {{"value": 0, "confidence": "High", "source": {{"url": "https://www.ontario.ca/page/electric-vehicles", "name": "Ontario — no provincial EV rebate since 2018", "accessed": "2026-04-25"}}}}
  }},
  "thermal_arrays": {{
    "cold_derate_curve": [],
    "hvac_draw_kw_by_temp": [],
    "hp_min_temp_c": -10,
    "precon_time_by_temp": [],
    "precon_thermal_gain": 0.85,
    "dc_cold_soak_curve": [],
    "charging_curve_20c": []
  }},
  "overall_confidence": "Medium"
}}
```

Pre-baked policy (DO NOT ask):
- **MSRP convention**: bare MSRP only — manufacturer .ca configurator price BEFORE freight, PDI, AC tax, dealer fees. If a press source quotes "as delivered $X,XXX (includes freight)", subtract freight (~$2,200) only if cited.
- **Range protocol**: EPA preferred. If only NRCan or WLTP available, use that and update `range_protocol`.
- **Confidence**: High = ≥3 CA sources within 1%. Medium = 2 within 5% OR 1 manufacturer .ca source. Low = 1 non-manufacturer or USD-converted.
- **iZEV / provincial rebate**: hardcode 0 with the cited disclaimer URLs above.
- **thermal_arrays**: leave empty arrays + defaults shown — Rust thermal model uses inline defaults.
- **NOT SOLD IN CANADA**: if no .ca listing AND no CA press coverage exists, write a JSON file with `{{"_skip": true, "reason": "..."}}` instead of the full result. Orchestrator will log + skip.

Sources (in order):
1. `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa` for "{year} {brand_display} {model} {trim_hint_short} Canada specs MSRP range"
2. `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa` for {primary_url} + ev-database.org + driving.ca
3. WebSearch / WebFetch fallback

Budget: 90 seconds, 12k tokens output. After writing, return ONE LINE: "wrote: {result_path_short}".
"""

TOW_DEFAULTS = {
    # Cars/sedans/coupes that aren't tow-rated in NA → keep value=0 + High + notes
    "Sedan": '{"value": 0, "confidence": "High", "notes": "Not rated for towing in North America."}',
    "Coupe": '{"value": 0, "confidence": "High", "notes": "Not rated for towing in North America."}',
    # SUVs / trucks / crossovers — let agent fetch
    "SUV": '{"value": ..., "confidence": "...", "source": {...}}',
    "Crossover": '{"value": ..., "confidence": "...", "source": {...}}',
    "Truck": '{"value": ..., "confidence": "...", "source": {...}}',
    "_default": '{"value": ..., "confidence": "...", "source": {...}}',
}


def infer_body_style(v: dict) -> str:
    model = v["model"].lower()
    trim = v.get("trim_hint", "").lower()
    if any(s in model for s in ("ev9", "ex30", "ex90", "solterra", "bz4x", "lyriq", "ix",
                                 "macan", "q6", "spectre", "g 580", "iq", "blazer",
                                 "explorer", "prologue", "zdx", "polestar 3", "hummer ev suv")):
        return "SUV"
    if any(s in model for s in ("i4", "i5", "i7", "taycan", "etron gt", "e-tron gt",
                                 "eqe", "eqs", "g80", "spectre")):
        return "Sedan"
    if "lyriq" in model or "iq" in model:
        return "SUV"
    return "SUV"  # safest default for the d04 list


def infer_drivetrain(v: dict) -> str:
    trim = v.get("trim_hint", "").lower()
    if "rwd" in trim and "awd" not in trim:
        return "SINGLE_MOTOR"
    if "fwd" in trim and "awd" not in trim:
        return "SINGLE_MOTOR"
    return "AWD"


def infer_port(v: dict) -> str:
    brand = v["brand_id"].lower()
    if brand in ("tesla", "rivian", "ford"):
        return "NACS"
    if brand in ("kia", "hyundai", "genesis"):
        # 2025+ Kia/Hyundai/Genesis NA models use NACS-equipped variants for some trims;
        # Defaults to NACS for new MY25+ models (EV9 has NACS port).
        if v.get("year", 0) >= 2025:
            return "NACS"
    return "CCS1"


def infer_seats(v: dict) -> int:
    model = v["model"].lower()
    trim = v.get("trim_hint", "").lower()
    if "ev9" in model or "prologue" in model:
        return 7
    if "lyriq" in model or "ix" in model or "ex90" in model:
        return 5  # 6/7 optional but base is 5
    return 5


def infer_generation_label(v: dict) -> str:
    year = v.get("year", 2025)
    return f"Gen 1 ({year}+)"


def emit_prompt(v: dict) -> str:
    body = infer_body_style(v)
    drivetrain = infer_drivetrain(v)
    port = infer_port(v)
    seats = infer_seats(v)
    gen = infer_generation_label(v)
    tow = TOW_DEFAULTS.get(body, TOW_DEFAULTS["_default"])
    brand_display = v.get("brand_name", v["brand_id"]).strip()
    trim_hint = v.get("trim_hint", "").strip()
    trim_short = trim_hint.split("—")[0].strip()[:60]
    trim_label = trim_short  # store the short trim as the canonical label
    primary_url = v.get("primary_url", "")
    result_path = f"{RESULTS_DIR.relative_to(ROOT)}/{v['id']}.result.json"
    result_path_full = str(RESULTS_DIR / f"{v['id']}.result.json")
    return PROMPT_TEMPLATE.format(
        year=v.get("year", 2025),
        brand_display=brand_display,
        model=v["model"],
        trim_hint=trim_hint,
        trim_hint_short=trim_short,
        result_path=result_path_full,
        result_path_short=result_path,
        id=v["id"],
        brand_id=v["brand_id"],
        generation_label=gen,
        year_start=v.get("year", 2025),
        year_end="null",
        body_style=body,
        drivetrain_variant=drivetrain,
        trim_label=trim_label,
        port_type=port,
        seats=seats,
        tow_value_block=tow,
        primary_url=primary_url,
    )


def cmd_list() -> int:
    vs = load_list()
    n_batches = math.ceil(len(vs) / BATCH_SIZE)
    print(f"D-04 list: {len(vs)} vehicles → {n_batches} batches of {BATCH_SIZE}")
    for n in range(1, n_batches + 1):
        print(f"\n=== Batch {n} ===")
        for v in vehicles_in_batch(n):
            print(f"  [{status_line(v)}] {v['id']:50s} {v.get('brand_name', v['brand_id'])} {v['model']} | {v.get('trim_hint','')[:50]}")
    return 0


def cmd_emit_prompt(vid: str) -> int:
    v = vehicle_by_id(vid)
    if not v:
        print(f"unknown vehicle id: {vid}", file=sys.stderr)
        return 1
    print(emit_prompt(v))
    return 0


def cmd_emit_batch(n: int) -> int:
    vs = vehicles_in_batch(n)
    if not vs:
        print(f"empty batch {n}", file=sys.stderr)
        return 1
    for i, v in enumerate(vs, 1):
        print(f"\n========================= AGENT {i}/{len(vs)} (B{n}.{i}) — {v['id']} =========================\n")
        print(emit_prompt(v))
    return 0


def cmd_apply_batch(n: int) -> int:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    vs = vehicles_in_batch(n)
    applied = skipped = failed = 0
    for v in vs:
        rf = RESULTS_DIR / f"{v['id']}.result.json"
        if not rf.exists():
            print(f"  ! missing result: {rf.relative_to(ROOT)} — skipping")
            skipped += 1
            continue
        # Detect _skip stub
        try:
            data = json.loads(rf.read_text(encoding="utf-8"))
            if isinstance(data, dict) and data.get("_skip"):
                print(f"  → SKIP (agent flag): {v['id']} — {data.get('reason','')[:80]}")
                skipped += 1
                continue
        except Exception as e:
            print(f"  ! corrupt result {rf.name}: {e}")
            failed += 1
            continue
        cmd = [sys.executable, str(APPLY), str(rf)]
        bn = v.get("brand_name") or v["brand_id"]
        bc = v.get("brand_country", "Unknown")
        cmd += ["--brand-name", bn, "--brand-country", bc]
        rc = subprocess.call(cmd, cwd=ROOT)
        if rc == 0:
            applied += 1
        else:
            failed += 1
    print(f"\n=== Batch {n}: applied={applied} skipped={skipped} failed={failed} ===")
    return 0 if failed == 0 else 1


def cmd_apply_all() -> int:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    n_batches = math.ceil(len(load_list()) / BATCH_SIZE)
    rcs = [cmd_apply_batch(n) for n in range(1, n_batches + 1)]
    return 0 if all(rc == 0 for rc in rcs) else 1


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--list", action="store_true")
    g.add_argument("--emit-prompt", help="vehicle id")
    g.add_argument("--emit-batch", type=int, help="batch N (1-indexed)")
    g.add_argument("--apply-batch", type=int)
    g.add_argument("--apply-all", action="store_true")
    args = ap.parse_args(argv[1:])

    if args.list:
        return cmd_list()
    if args.emit_prompt:
        return cmd_emit_prompt(args.emit_prompt)
    if args.emit_batch is not None:
        return cmd_emit_batch(args.emit_batch)
    if args.apply_batch is not None:
        return cmd_apply_batch(args.apply_batch)
    if args.apply_all:
        return cmd_apply_all()
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
