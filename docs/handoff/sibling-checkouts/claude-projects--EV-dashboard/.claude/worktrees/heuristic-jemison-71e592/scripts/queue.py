#!/usr/bin/env python3
"""
Queue ranker. Parses AUTONOMOUS_PLAN.md tables, applies the plan's ranking
formula (value × readiness / cost), and prints the top-N READY items.
Also writes .queue_top3.md — the tiny volatile file session-start hooks read.

Usage:
    python3 scripts/queue.py            # prints top 3, writes .queue_top3.md
    python3 scripts/queue.py --n 5      # top 5
    python3 scripts/queue.py --all      # all READY items

Ranking formula (matches AUTONOMOUS_PLAN.md § How this plan is used):

    priority = value × readiness / cost

Tie-breakers, in order:
    (a) unblocks-the-most-other-items (heuristic: F- items rank higher than P-)
    (b) most recently validated user interest (source-of-truth = zone order)
    (c) current-thread momentum (zone order)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
PLAN = ROOT / "AUTONOMOUS_PLAN.md"
TOP3 = ROOT / ".queue_top3.md"
SESSION_SUMMARY = ROOT / "SESSION_SUMMARY.md"
PHASE_METRICS = ROOT / "PHASE_METRICS.md"

# Zone headers in order of active-ness.
ZONE_ORDER = [
    ("⚡ Now", 0),
    ("🟡 Next", 1),
    ("🟠 Waiting", 2),
    ("🔵 Considered later", 3),
]

# Match a queue row:  | N | **ID** | Title | V | C | R | Notes |
# Where V, C, R are single digits or 0.5.
ROW_RE = re.compile(
    r"^\|\s*\d+\s*\|\s*\*\*(?P<id>[A-Z]-\d+)\*\*\s*\|"
    r"\s*(?P<title>.+?)\s*\|"
    r"\s*(?P<value>\d+(?:\.\d+)?)\s*\|"
    r"\s*(?P<cost>\d+(?:\.\d+)?)\s*\|"
    r"\s*(?P<ready>\d+(?:\.\d+)?)\s*\|"
    r"\s*(?P<notes>.*?)\s*\|"
)

# Strikethrough rows (~~I-01~~) are completed; skip them.
STRIKE_RE = re.compile(r"\|\s*~~")


def parse_plan() -> list[dict]:
    if not PLAN.exists():
        print(f"ERROR: {PLAN} not found", file=sys.stderr)
        sys.exit(1)

    text = PLAN.read_text(encoding="utf-8")
    lines = text.splitlines()
    zone_idx = -1
    items: list[dict] = []

    for line in lines:
        # Detect zone header
        for header, idx in ZONE_ORDER:
            if header in line and line.lstrip().startswith("###"):
                zone_idx = idx
                break

        if zone_idx < 0:
            continue

        if STRIKE_RE.search(line):
            continue

        m = ROW_RE.match(line)
        if not m:
            continue
        try:
            value = float(m["value"])
            cost = float(m["cost"])
            ready = float(m["ready"])
        except ValueError:
            continue
        priority = (value * ready) / cost if cost > 0 else 0
        # Tie-breaker: lower zone index wins; F- > P- on same priority
        prefix = m["id"].split("-")[0]
        prefix_rank = {"B": 0, "F": 1, "D": 2, "I": 3, "P": 4}.get(prefix, 5)
        items.append(
            {
                "id": m["id"],
                "title": m["title"],
                "value": value,
                "cost": cost,
                "ready": ready,
                "priority": priority,
                "zone": zone_idx,
                "prefix_rank": prefix_rank,
                "notes": m["notes"],
            }
        )

    return items


def rank(items: list[dict], ready_only: bool = True) -> list[dict]:
    if ready_only:
        items = [i for i in items if i["ready"] >= 1]
    return sorted(
        items,
        key=lambda i: (-i["priority"], i["zone"], i["prefix_rank"]),
    )


def render_item(item: dict, tag: str | None = None) -> str:
    tag_str = f" [{tag}]" if tag else ""
    return (
        f"- **{item['id']}** (value={item['value']:.0f}, "
        f"cost={item['cost']:.0f}, priority={item['priority']:.2f}){tag_str} — {item['title']}"
    )


# Lightweight heuristic mapping from item title → task complexity tag.
# Used when --respect-level is on to filter the queue to compatible work.
def infer_task_tag(title: str) -> str:
    t = title.lower()
    # order matters — most specific first
    if any(k in t for k in ["spec ", "design ", "architect", "plan ", "rewrite"]):
        return "spec-writing"
    if any(k in t for k in ["physics", "thermal model", "compute_thermal", "rollup"]):
        return "physics-model-change"
    if any(k in t for k in ["importer", "import ", "openev", "scraper", "new api", "integrate"]):
        return "external-api-design"
    if any(k in t for k in ["maplibre", "swap leaflet", "swap "]):
        return "rust-crate-integration"
    if any(k in t for k in ["refactor", "restructure"]):
        return "architectural-refactor"
    if any(k in t for k in ["seed.json", "data update", "fill citation"]):
        return "data-update"
    if any(k in t for k in ["bug ", "fix ", "regression"]):
        return "bug-fix-clear-repro"
    if any(k in t for k in ["test", "vitest", "cargo test"]):
        return "test-addition"
    if any(k in t for k in ["toast", "ui ", "label", "tooltip", "tray", "tab"]):
        return "ui-tweak-single-file"
    if any(k in t for k in ["chrome-mcp", "validate ui", "regression sweep"]):
        return "chrome-mcp-validation"
    if any(k in t for k in ["research", "exa pass", "verify across", "survey"]):
        return "research-deep"
    if any(k in t for k in ["doc", "guide", "playbook"]):
        return "documentation"
    if any(k in t for k in ["archive ", "delete dead", "cleanup", "rename"]):
        return "dead-code-archive"
    if any(k in t for k in ["commit", "milestone", "ritual"]):
        return "milestone-ritual"
    if any(k in t for k in ["typo", "format"]):
        return "typo-fix"
    return "default"


def filter_for_level(items: list[dict]) -> tuple[list[dict], list[dict], str, str]:
    """Filter items to those compatible with the currently detected level.

    Returns (compatible, skipped, model, effort). On detection failure, returns
    all items (don't block) and ("unknown", "unknown") so the caller can warn.
    """
    import json
    import subprocess

    detect_path = Path(__file__).resolve().parent / "detect_level.py"
    try:
        res = subprocess.run(
            [sys.executable, str(detect_path), "--json"],
            check=False,
            capture_output=True,
            text=True,
        )
        info = json.loads(res.stdout) if res.returncode == 0 else {}
    except (OSError, json.JSONDecodeError):
        info = {}
    if not info.get("ok"):
        return items, [], "unknown", "unknown"

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from task_complexity import fits  # noqa: E402

    model = info.get("model", "unknown")
    effort = info.get("effort", "unknown")
    compatible: list[dict] = []
    skipped: list[dict] = []
    for it in items:
        tag = infer_task_tag(it["title"])
        ok, _ = fits(effort, model, tag)
        it = dict(it, tag=tag)
        (compatible if ok else skipped).append(it)
    return compatible, skipped, model, effort


def _check_git_clean() -> bool:
    res = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True)
    return res.returncode == 0 and not res.stdout.strip()


def _check_vitest() -> bool:
    res = subprocess.run(
        ["npm", "test", "--silent", "--", "--run", "--reporter=dot"],
        cwd=ROOT, capture_output=True, text=True, timeout=180,
    )
    return res.returncode == 0


def _check_validate() -> bool:
    res = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "validate.py")],
        cwd=ROOT, capture_output=True, text=True, timeout=60,
    )
    return res.returncode == 0


def _check_metrics_fresh(max_age_min: int = 60) -> bool:
    """metrics.py output (PHASE_METRICS.md) ≤ max_age_min old."""
    if not PHASE_METRICS.exists():
        return False
    age = datetime.now(timezone.utc).timestamp() - PHASE_METRICS.stat().st_mtime
    return age <= max_age_min * 60


def health_badge_line(skip_vitest: bool = False) -> str:
    """Return a single-line health badge for SESSION_SUMMARY.md (I-08).

    Skips the vitest check if `skip_vitest=True` (used inside the milestone
    ritual to avoid a recursive npm test inside an npm test). The other three
    checks are cheap.
    """
    git_ok = _check_git_clean()
    validate_ok = _check_validate()
    metrics_ok = _check_metrics_fresh()
    vitest_ok = True if skip_vitest else _check_vitest()
    checks = [
        ("git", git_ok),
        ("vitest", vitest_ok),
        ("validate", validate_ok),
        ("metrics-fresh", metrics_ok),
    ]
    passed = sum(1 for _, ok in checks if ok)
    total = len(checks)
    if passed == total:
        light = "🟢"
    elif passed >= total - 1:
        light = "🟡"
    else:
        light = "🔴"
    breakdown = " · ".join(f"{name}{'✅' if ok else '❌'}" for name, ok in checks)
    return f"{light} **Health: {passed}/{total}** — {breakdown}"


def write_health_badge_to_session_summary(skip_vitest: bool = False) -> None:
    """Inject (or update) the health badge line at the very top of SESSION_SUMMARY.md.

    Idempotent — finds an existing `🟢|🟡|🔴 **Health:` line and replaces it,
    or inserts after the H1 if missing. Non-fatal: any error is silently
    swallowed so milestone ritual never halts on a cosmetic update.
    """
    try:
        if not SESSION_SUMMARY.exists():
            return
        badge = health_badge_line(skip_vitest=skip_vitest)
        text = SESSION_SUMMARY.read_text(encoding="utf-8")
        # Replace any existing badge line
        new_text, n = re.subn(
            r"^[🟢🟡🔴] \*\*Health: \d+/\d+\*\*.*$",
            badge,
            text,
            count=1,
            flags=re.MULTILINE,
        )
        if n == 0:
            # Insert immediately after the first H1 line.
            lines = text.splitlines()
            insert_at = 1
            for i, line in enumerate(lines):
                if line.startswith("# "):
                    insert_at = i + 1
                    break
            lines.insert(insert_at, "")
            lines.insert(insert_at + 1, badge)
            new_text = "\n".join(lines) + ("" if text.endswith("\n") else "\n")
        SESSION_SUMMARY.write_text(new_text, encoding="utf-8")
    except Exception:
        # Cosmetic — never block the ritual.
        pass


def main(argv: list[str]) -> int:
    n = 3
    show_all = False
    respect_level = False
    for i, arg in enumerate(argv):
        if arg == "--n" and i + 1 < len(argv):
            n = int(argv[i + 1])
        if arg == "--all":
            show_all = True
        if arg == "--respect-level":
            respect_level = True

    # I-08 — write a health badge to SESSION_SUMMARY.md every time the queue
    # is re-ranked. Skip vitest inside milestone ritual to avoid recursive npm.
    skip_vitest = "--skip-vitest" in argv or any(
        "milestone" in str(p) for p in (sys.argv[0:1] or [])
    )
    write_health_badge_to_session_summary(skip_vitest=skip_vitest)

    items = parse_plan()
    ranked = rank(items, ready_only=not show_all)

    skipped: list[dict] = []
    level_note = ""
    if respect_level:
        ranked, skipped, model, effort = filter_for_level(ranked)
        if model == "unknown":
            level_note = "*level detection failed — showing unfiltered*\n\n"
        else:
            level_note = f"*level: {model} / {effort}*\n\n"

    top = ranked if show_all else ranked[:n]

    header = (
        f"# Top {len(top)} READY queue items\n\n"
        f"*Auto-generated by `scripts/queue.py`.*\n\n"
        f"{level_note}"
    )
    body = "\n".join(render_item(i, i.get("tag")) for i in top) + "\n"
    if skipped:
        # Group skipped items by their required level so a future level switch
        # immediately surfaces "what unlocks if I bump up to X".
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from task_complexity import lookup as _task_lookup  # noqa: E402

        groups: dict[str, list[dict]] = {}
        for it in skipped:
            min_effort, min_model, _ = _task_lookup(it.get("tag", "default"))
            groups.setdefault(f"{min_model}/{min_effort}", []).append(it)
        body += "\n_Deferred — parked above current level:_\n"
        for key in sorted(groups):
            body += f"\n_Requires `{key}`:_\n"
            body += "\n".join(render_item(i, i.get("tag")) for i in groups[key]) + "\n"
    TOP3.write_text(header + body, encoding="utf-8")

    print(header + body)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
