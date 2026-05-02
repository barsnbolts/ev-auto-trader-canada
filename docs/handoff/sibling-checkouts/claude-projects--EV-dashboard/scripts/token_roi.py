#!/usr/bin/env python3
"""
Token-ROI discipline — the ongoing, always-on accounting layer.

cost_tracker.py records WHAT was spent. token_roi.py asks WAS IT WORTH IT,
and gates future spend when the answer is trending no.

Four surfaces:

  1. Pre-flight estimator
        token_roi.py preflight <operation_kind> [--payload-bytes N]
     Prints expected input/output tokens + probability bands BEFORE dispatch,
     so a cheap alternative can be chosen if the estimate is bad.

  2. Ongoing ledger
        token_roi.py log <op_kind> <est_tokens> <actual_tokens> <value_score 1-5> "<note>"
     Appends to logs/operation_ledger.jsonl. Any tool call worth measuring
     (subagent dispatch, bulk read, bloat pass, etc.) goes here — not just
     milestones.

  3. ROI dashboard
        token_roi.py dashboard
     Shows: today's spend vs budget, 7-day trend, median ROI by op_kind,
     top offenders (highest cost / lowest value), and the current bloat score
     (tokens in always-loaded docs).

  4. ROI gate
        token_roi.py gate <milestone_id>
     Called from milestone.py step 8. Computes milestone spend vs kind-median
     from cost_tracker. Exits non-zero if spend > 2× median without an
     explicit override env var (TOKEN_ROI_OVERRIDE=1), forcing the operator
     to acknowledge the cost.

Why this exists: in prior sessions we got calibrated numbers (data ~103k,
feature ~0). Knowing the medians is useless if we don't check against them.
This turns knowledge into enforcement.
"""

from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from datetime import datetime, date, timedelta
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "logs" / "operation_ledger.jsonl"
COSTS = ROOT / "logs" / "milestone_costs.jsonl"
BUDGET_FILE = ROOT / "logs" / "daily_budget.json"
AGENT_LOGS = ROOT / "logs" / "subagent_runs"
BLOAT_TARGETS = [
    ROOT / "CLAUDE.md",
    ROOT / "SESSION_SUMMARY.md",
    ROOT / ".auto-memory" / "MEMORY.md",
]

# Heuristic token estimates per op_kind. Tune from actual data over time.
PREFLIGHT = {
    "subagent_data":     {"in": 8_000,   "out_lo": 60_000,  "out_hi": 140_000, "ok_if_lt": 120_000},
    "subagent_verify":   {"in": 6_000,   "out_lo": 8_000,   "out_hi": 30_000,  "ok_if_lt": 25_000},
    "subagent_research": {"in": 4_000,   "out_lo": 6_000,   "out_hi": 20_000,  "ok_if_lt": 18_000},
    "exa_query":         {"in": 500,     "out_lo": 1_500,   "out_hi": 6_000,   "ok_if_lt": 5_000},
    "bulk_read":         {"in": 15_000,  "out_lo": 0,       "out_hi": 0,       "ok_if_lt": 10_000},
    "direct_code":       {"in": 0,       "out_lo": 500,     "out_hi": 3_000,   "ok_if_lt": 3_000},
    "validation_gate":   {"in": 200,     "out_lo": 200,     "out_hi": 800,     "ok_if_lt": 1_000},
    "chrome_validation": {"in": 500,     "out_lo": 500,     "out_hi": 2_000,   "ok_if_lt": 2_500},
}


# ──────────────────────────────────────────────────────────────
# ledger
# ──────────────────────────────────────────────────────────────
def log_op(kind: str, est: int, actual: int, value: int, note: str) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "day": date.today().isoformat(),
        "kind": kind,
        "estimated_tokens": int(est),
        "actual_tokens": int(actual),
        "value_score": int(value),
        "roi": (int(value) / max(int(actual), 1)) * 10_000,  # value per 10k tokens
        "note": note[:180],
    }
    with LEDGER.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry) + "\n")
    print(f"logged {kind} · {actual:,} tok · value {value}/5 · ROI {entry['roi']:.2f}/10k")


def read_ledger() -> list[dict]:
    if not LEDGER.exists():
        return []
    out = []
    for line in LEDGER.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except Exception:
                pass
    return out


# ──────────────────────────────────────────────────────────────
# pre-flight
# ──────────────────────────────────────────────────────────────
def preflight(kind: str, payload_bytes: int = 0) -> int:
    spec = PREFLIGHT.get(kind)
    if spec is None:
        print(f"unknown op_kind '{kind}'. Known: {', '.join(sorted(PREFLIGHT))}")
        return 2
    # rough: 1 token ≈ 4 bytes
    payload_tokens = payload_bytes // 4
    lo = spec["in"] + payload_tokens + spec["out_lo"]
    hi = spec["in"] + payload_tokens + spec["out_hi"]
    mid = (lo + hi) // 2
    ok = mid <= spec["ok_if_lt"]
    verdict = "OK" if ok else "⚠ EXPENSIVE"
    print(f"pre-flight · {kind}")
    print(f"  estimate:   {lo:>7,} — {hi:>7,} tokens (mid ~{mid:,})")
    print(f"  budget for this kind: ≤ {spec['ok_if_lt']:,}")
    print(f"  verdict: {verdict}")
    if not ok:
        print("  consider: batch the request, use direct_code, or split work.")
    return 0 if ok else 1


# ──────────────────────────────────────────────────────────────
# budget
# ──────────────────────────────────────────────────────────────
def load_budget() -> dict:
    if BUDGET_FILE.exists():
        try:
            return json.loads(BUDGET_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"daily_cap_tokens": 500_000, "set_at": date.today().isoformat()}


def set_budget(cap: int) -> None:
    BUDGET_FILE.parent.mkdir(parents=True, exist_ok=True)
    BUDGET_FILE.write_text(
        json.dumps({"daily_cap_tokens": cap, "set_at": date.today().isoformat()}, indent=2),
        encoding="utf-8",
    )
    print(f"daily token cap set to {cap:,}")


def spend_today() -> int:
    today = date.today().isoformat()
    total = 0
    for e in read_ledger():
        if e.get("day") == today:
            total += e.get("actual_tokens", 0)
    return total


# ──────────────────────────────────────────────────────────────
# dashboard
# ──────────────────────────────────────────────────────────────
def bloat_score() -> tuple[int, list[tuple[str, int]]]:
    per = []
    total = 0
    for p in BLOAT_TARGETS:
        if p.exists():
            t = p.read_text(encoding="utf-8")
            # rough 4-byte-per-token heuristic on UTF-8 text
            tokens = len(t.encode("utf-8")) // 4
            per.append((str(p.relative_to(ROOT)), tokens))
            total += tokens
    return total, per


def dashboard() -> None:
    budget = load_budget()
    today_spent = spend_today()
    cap = budget["daily_cap_tokens"]
    pct = (today_spent / cap * 100) if cap else 0

    print("━" * 60)
    print("Token ROI · dashboard")
    print("━" * 60)
    print(f"Today's spend:   {today_spent:>10,} / {cap:,} ({pct:.0f}% of cap)")

    # 7-day trend
    ledger = read_ledger()
    by_day: dict[str, int] = defaultdict(int)
    for e in ledger:
        by_day[e.get("day", "?")] += e.get("actual_tokens", 0)
    if by_day:
        last = sorted(by_day.items())[-7:]
        print("\nLast 7 days:")
        for d, v in last:
            bar = "▇" * max(1, int(v / max(cap, 1) * 40))
            print(f"  {d}  {v:>10,}  {bar}")

    # ROI by op_kind
    by_kind: dict[str, list[dict]] = defaultdict(list)
    for e in ledger:
        by_kind[e.get("kind", "?")].append(e)
    if by_kind:
        print(f"\n{'op_kind':18} {'count':>5} {'median_tok':>12} {'median_val':>12} {'ROI/10k':>10}")
        for k in sorted(by_kind):
            items = by_kind[k]
            tokens = [i.get("actual_tokens", 0) for i in items]
            vals = [i.get("value_score", 0) for i in items]
            rois = [i.get("roi", 0) for i in items]
            print(
                f"{k:18} {len(items):>5} "
                f"{int(median(tokens)):>12,} "
                f"{median(vals):>12.1f} "
                f"{median(rois):>10.2f}"
            )

    # Bloat
    total, per = bloat_score()
    print(f"\nAlways-loaded docs bloat: ~{total:,} tokens")
    for p, t in per:
        flag = "⚠" if t > 2_500 else "✓"
        print(f"  {flag} {p:40} ~{t:,} tokens")

    # Top offenders — highest cost / lowest value
    offenders = sorted(
        [e for e in ledger if e.get("actual_tokens", 0) > 20_000],
        key=lambda e: e.get("roi", 0),
    )[:5]
    if offenders:
        print("\nLowest-ROI big ops (review whether to repeat):")
        for e in offenders:
            print(f"  {e['kind']:20} {e['actual_tokens']:>8,} tok · val {e['value_score']}/5 · {e.get('note','')[:60]}")

    print("━" * 60)


# ──────────────────────────────────────────────────────────────
# gate
# ──────────────────────────────────────────────────────────────
def load_cost_entries() -> list[dict]:
    if not COSTS.exists():
        return []
    out = []
    for line in COSTS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except Exception:
                pass
    return out


def gate(mid: str) -> int:
    """Return 0 if milestone ROI looks OK, 1 if it trips a threshold."""
    entries = load_cost_entries()
    this = [e for e in entries if e.get("id") == mid]
    if not this:
        print(f"no cost record for {mid} yet — nothing to gate against")
        return 0
    ent = this[-1]
    kind = ent.get("kind", "other")
    this_tokens = ent.get("actual_subagent_tokens", 0)
    peers = [
        e.get("actual_subagent_tokens", 0)
        for e in entries
        if e.get("kind") == kind
        and e.get("id") != mid
        and e.get("actual_subagent_tokens", 0) > 0
    ]
    if not peers:
        print(f"{mid}: no peer history for kind '{kind}' — skipping threshold check")
        return 0
    med = median(peers)
    ratio = (this_tokens / med) if med else 0
    print(f"{mid} ({kind}): {this_tokens:,} tokens · peer median {int(med):,} · ratio {ratio:.2f}×")

    # Bloat check — always-loaded doc tokens
    total_bloat, per = bloat_score()
    if total_bloat > 8_000:
        print(f"⚠ always-loaded docs total {total_bloat:,} tokens — trim before next milestone")

    if ratio > 2.0 and os.environ.get("TOKEN_ROI_OVERRIDE") != "1":
        print("✗ ROI gate: cost > 2× median for kind. Set TOKEN_ROI_OVERRIDE=1 to proceed.")
        return 1
    print("✓ ROI gate passed")
    return 0


# ──────────────────────────────────────────────────────────────
# main
# ──────────────────────────────────────────────────────────────
USAGE = """Usage:
  token_roi.py preflight <op_kind> [payload_bytes]
  token_roi.py log <op_kind> <est_tokens> <actual_tokens> <value 1-5> "<note>"
  token_roi.py dashboard
  token_roi.py gate <milestone_id>
  token_roi.py budget <tokens_per_day>
  token_roi.py spend
"""


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(USAGE)
        return 2
    cmd = argv[1]
    if cmd == "preflight":
        if len(argv) < 3:
            print(USAGE)
            return 2
        payload = int(argv[3]) if len(argv) > 3 else 0
        return preflight(argv[2], payload)
    if cmd == "log":
        if len(argv) < 7:
            print(USAGE)
            return 2
        log_op(argv[2], int(argv[3]), int(argv[4]), int(argv[5]), argv[6])
        return 0
    if cmd == "dashboard":
        dashboard()
        return 0
    if cmd == "gate":
        if len(argv) < 3:
            print(USAGE)
            return 2
        return gate(argv[2])
    if cmd == "budget":
        if len(argv) < 3:
            print(USAGE)
            return 2
        set_budget(int(argv[2]))
        return 0
    if cmd == "spend":
        s = spend_today()
        b = load_budget()["daily_cap_tokens"]
        pct = (s / b * 100) if b else 0
        print(f"today: {s:,} / {b:,} tokens ({pct:.0f}%)")
        return 0
    print(USAGE)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
