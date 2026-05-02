#!/usr/bin/env python3
"""
Deep audit — 15-dimension sweep of the whole project.

Modes:
    --fast    D1, D3, D4, D12, D15   (~30 sec, gate-level)
    --full    all 15 dimensions      (~5 min + maybe 1 subagent)

Writes reports/deep-audit-YYYY-MM-DD-HHMM.md with structured findings
tagged blocker / warn / info. Re-runs are diffable against previous.

Cadence: every ~10 milestones (or every batch close if --fast).
Manual trigger: before stream D expansions, Tauri releases, or new data sources.

Usage:
    python3 scripts/deep_audit.py            # default --fast
    python3 scripts/deep_audit.py --full
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"
SCRIPTS = ROOT / "scripts"

SEVERITY_ORDER = {"blocker": 0, "warn": 1, "info": 2}


@dataclass
class Finding:
    dim: str
    severity: str
    message: str


@dataclass
class Audit:
    findings: list[Finding] = field(default_factory=list)
    mode: str = "fast"

    def add(self, dim: str, severity: str, msg: str) -> None:
        self.findings.append(Finding(dim, severity, msg))

    def report(self) -> str:
        blockers = [f for f in self.findings if f.severity == "blocker"]
        warns = [f for f in self.findings if f.severity == "warn"]
        infos = [f for f in self.findings if f.severity == "info"]
        lines = [
            f"# Deep audit — {datetime.now().strftime('%Y-%m-%d %H:%M')} ({self.mode})",
            "",
            f"**{len(blockers)}** blocker · **{len(warns)}** warn · {len(infos)} info",
            "",
        ]
        for severity, icon in (("blocker", "✗"), ("warn", "⚠"), ("info", "·")):
            items = [f for f in self.findings if f.severity == severity]
            if not items:
                continue
            lines.append(f"## {severity.upper()} ({len(items)})")
            lines.append("")
            for f in items:
                lines.append(f"- {icon} **[{f.dim}]** {f.message}")
            lines.append("")
        return "\n".join(lines)


def sh(cmd: list[str]) -> tuple[int, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return p.returncode, (p.stdout + p.stderr).strip()
    except Exception as e:
        return 1, str(e)


# ---- Dimensions ----------------------------------------------------------

def d1_typescript(a: Audit) -> None:
    # tsc not installed in sandbox; we only inform. Real run happens on Ian's Mac.
    if not (ROOT / "node_modules" / ".bin" / "tsc").exists():
        a.add("D1 TS", "info", "tsc not installed locally (run `npm install` on Mac); skipping noEmit check")
        return
    rc, out = sh([str(ROOT / "node_modules" / ".bin" / "tsc"), "--noEmit"])
    if rc != 0:
        a.add("D1 TS", "blocker", f"tsc reports errors:\n{out[:2000]}")
    else:
        a.add("D1 TS", "info", "tsc --noEmit clean")


def d3_thermal(a: Audit) -> None:
    rc, out = sh([sys.executable, str(SCRIPTS / "validate_thermal.py")])
    if rc != 0:
        a.add("D3 thermal", "blocker", "thermal anchors failing — see output")
    else:
        lines = [l for l in out.splitlines() if "anchors" in l or "pass" in l]
        a.add("D3 thermal", "info", " / ".join(lines) if lines else "passed")


def d4_data_integrity(a: Audit) -> None:
    rc, out = sh([sys.executable, str(SCRIPTS / "metrics.py")])
    if rc != 0:
        a.add("D4 data", "blocker", "metrics.py failed — seed may be malformed")
    else:
        a.add("D4 data", "info", out.splitlines()[0] if out else "passed")


def d5_dead_code(a: Audit) -> None:
    # Heuristic: ripgrep exports not imported anywhere.
    exports: dict[str, Path] = {}
    for f in (ROOT / "src").rglob("*.ts*"):
        if f.name.endswith(".test.ts") or f.name.endswith(".d.ts"):
            continue
        for m in re.finditer(r"^export (?:const|function|class|interface|type)\s+(\w+)", f.read_text(encoding="utf-8"), re.MULTILINE):
            exports[m.group(1)] = f
    unused = []
    for name, src in exports.items():
        rc, out = sh(["grep", "-rl", f"\\b{name}\\b", str(ROOT / "src"), "--include=*.ts", "--include=*.tsx"])
        # File where declared doesn't count as "use."
        files = set((out or "").splitlines()) - {str(src)}
        if not files:
            unused.append(f"{name} in {src.relative_to(ROOT)}")
    if len(unused) > 5:
        a.add("D5 dead-code", "warn", f"{len(unused)} unused exports (first 5): {', '.join(unused[:5])}")
    else:
        a.add("D5 dead-code", "info", f"{len(unused)} unused exports (low)")


def d7_bundle_size(a: Audit) -> None:
    dist = ROOT / "dist"
    if not dist.exists():
        a.add("D7 bundle", "info", "no dist/ yet (run `npm run build` to measure)")
        return
    total = sum(f.stat().st_size for f in dist.rglob("*") if f.is_file())
    a.add("D7 bundle", "info", f"dist/ = {total/1024:.1f} KB")


def d12_memory(a: Audit) -> None:
    rc, out = sh([sys.executable, str(SCRIPTS / "validate_system.py")])
    if rc != 0:
        a.add("D12 memory", "blocker", "validate_system.py failed")
    else:
        warns = [l for l in out.splitlines() if "⚠" in l]
        if warns:
            a.add("D12 memory", "warn", " / ".join(warns))
        else:
            a.add("D12 memory", "info", "clean")


def d14_doc_currency(a: Audit) -> None:
    from datetime import datetime, timezone
    primary = ["CLAUDE.md", "SESSION_SUMMARY.md", "BATCH_PLAN.md", "AUTONOMOUS_PLAN.md"]
    now = datetime.now(timezone.utc).timestamp()
    for name in primary:
        p = ROOT / name
        if not p.exists():
            a.add("D14 docs", "warn", f"{name} missing")
            continue
        age_days = (now - p.stat().st_mtime) / 86400
        if age_days > 14:
            a.add("D14 docs", "warn", f"{name} is {age_days:.0f} days old (>14)")
    a.add("D14 docs", "info", f"{len(primary)} primary docs audited")


def d15_snapshots(a: Audit) -> None:
    snaps = ROOT / "snapshots"
    if not snaps.exists():
        a.add("D15 snapshots", "warn", "snapshots/ missing")
        return
    files = list(snaps.glob("*-seed.json"))
    if len(files) < 5:
        a.add("D15 snapshots", "warn", f"only {len(files)} snapshots (low — recommend ≥5)")
    elif len(files) > 50:
        a.add("D15 snapshots", "warn", f"{len(files)} snapshots (high — archive old)")
    else:
        a.add("D15 snapshots", "info", f"{len(files)} snapshots")


def d13_prompt_drift(a: Audit) -> None:
    # Soft check: prompt template files exist and have version headers.
    tdir = SCRIPTS / "prompt_templates"
    if not tdir.exists():
        a.add("D13 prompt", "info", "no prompt_templates/")
        return
    for p in tdir.glob("*.md"):
        text = p.read_text(encoding="utf-8")
        if not re.search(r"version.*v\d", text, re.IGNORECASE):
            a.add("D13 prompt", "warn", f"{p.name} has no version marker")
    a.add("D13 prompt", "info", f"{len(list(tdir.glob('*.md')))} templates tracked")


# ---- Orchestrator --------------------------------------------------------

def main(argv: list[str]) -> int:
    mode = "fast"
    if "--full" in argv:
        mode = "full"
    audit = Audit(mode=mode)

    # Fast dimensions (always run)
    d1_typescript(audit)
    d3_thermal(audit)
    d4_data_integrity(audit)
    d12_memory(audit)
    d15_snapshots(audit)

    if mode == "full":
        d5_dead_code(audit)
        d7_bundle_size(audit)
        d13_prompt_drift(audit)
        d14_doc_currency(audit)
        # D2 (tests), D6 (duplicate logic), D8 (rerenders), D9 (a11y), D10 (code review), D11 (deps)
        # are either slower or need subagent dispatch — stubs left for future:
        audit.add("D2 tests", "info", "unit-test runner not wired yet — port thermal.test.ts to vitest first")
        audit.add("D6 dup-logic", "info", "dup-block detector not wired — future: jsinspect or jscpd")
        audit.add("D8 rerenders", "info", "React Profiler requires Chrome-MCP session; run manually")
        audit.add("D9 a11y", "info", "run `design:accessibility-review` skill manually for full WCAG pass")
        audit.add("D10 code-review", "info", "run `engineering:code-review` skill manually on recent diff")
        audit.add("D11 deps", "info", "run `npm audit` on Ian's Mac")

    REPORTS.mkdir(exist_ok=True)
    report = audit.report()
    path = REPORTS / f"deep-audit-{datetime.now().strftime('%Y-%m-%d-%H%M')}.md"
    path.write_text(report, encoding="utf-8")
    print(report)
    print(f"\nSaved to {path.relative_to(ROOT)}")

    blockers = sum(1 for f in audit.findings if f.severity == "blocker")
    return 1 if blockers > 0 else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
