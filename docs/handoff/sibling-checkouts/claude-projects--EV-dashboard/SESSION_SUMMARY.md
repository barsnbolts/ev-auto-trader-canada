# Session summary — EV Dashboard

*Last updated: 2026-04-23 · feature-complete*

## Stage: all 6 batches closed · 22 milestones shipped · feature-complete ✅

The app now covers every feature originally scoped: physics slider with real per-vehicle heat-pump thermal modeling, live charging curves, cost-per-km in Ontario dollars, interactive map with range rings, live DCFC station discovery via Open Charge Map, road-distance trip verdicts via OSRM, full charge-stop planner with per-vehicle timing, battery-degradation projection, iZEV eligibility wizard, mom-friendly plain-English mode, used-market deep-link to AutoTrader/Kijiji, and a Tauri desktop-build path.

## What's live — the full feature list

**Compare view**
- 37 vehicles, 16 brands, Long-Range trims only, generation-aware
- 30 H / 6 M / 1 L confidence with cited sources
- Compare tray (up to 4 vehicles), persisted across reloads
- Plain-English mode toggle ("mom mode")

**Physics layer**
- Temperature slider −40 → +40 °C, preconditioning toggle per vehicle
- HVAC on/off, driving speed, electricity-rate inputs
- Per-vehicle heat-pump cutoff override (Tesla −30, Rivian −25, others −20)
- Confidence auto-downgrades at temperature extremes

**Live-updating numbers**
- Range @ slider · Effective usable kWh · Peak DC @ slider · Effective consumption · Capacity retained · HVAC draw · Cost per 100 km
- Charging-curve overlay chart — kW vs SoC, flattens under cold, restores with preconditioning
- Battery-life projection — 5 / 8 / 10-yr range per chemistry
- iZEV eligibility wizard with cap check

**Breakdown drawers** — click any Adjusted row, see the formula with inputs

**Map**
- Leaflet + OpenStreetMap
- Click-to-set location
- Concentric range rings per compared vehicle
- DCFC pins: live from Open Charge Map when `VITE_OCM_KEY` set, 15 demo stations otherwise
- Nominatim geocoding for destinations

**Trip planning**
- Road-distance routing via OSRM (falls back to straight-line)
- Per-vehicle charge-stop planner: stops × SoC × minutes × station
- FASTEST badge on the winning vehicle
- Colder slider state → more stops, each slower

**Used market**
- Pre-filled search links to AutoTrader.ca + Kijiji + EV-Database per vehicle
- Rough 3-yr used-value anchor
- "Ask Claude in chat" escape hatch for deeper Exa-backed searches

**Packaging**
- Three double-click `.command` launchers (setup, web, desktop)
- `npm run tauri:build` path documented in [RELEASING.md](./RELEASING.md)

## Self-learning system (meta-infrastructure)

Every milestone is gated by `scripts/milestone.py` (7-step pipeline: metrics → system validator → thermal validator → snapshot → LEARNINGS → timestamp → queue preview + reflection prompts). Every batch close runs `scripts/batch_ritual.py` (8-step deep pass: deep validation → bloat audit → snapshot rotation → subagent log review → memory pass → retrospective → plan update → token economy). Every subagent dispatch is logged to `logs/subagent_runs/` with an `improvements_for_next_run` field that feeds the next prompt template version.

The validator caught three real drift issues this session: `hpMinC = -10°C` too conservative, two speculative Polestar/VW HP overrides, and a missing `drivetrain_variant` field on one subagent-authored record. Fixing each was trivial; the catch itself is the point.

## Project docs

- [**CLAUDE.md**](./CLAUDE.md) — codebase context for any fresh Claude session (start here)
- [**SESSION_SUMMARY.md**](./SESSION_SUMMARY.md) — this file, current-state landing page
- [**BATCH_PLAN.md**](./BATCH_PLAN.md) — 6-batch roadmap, all ✅
- [**AUTONOMOUS_PLAN.md**](./AUTONOMOUS_PLAN.md) — thin tactical view
- [**LEARNINGS.md**](./LEARNINGS.md) — 30+ dated entries
- [**CHANGELOG.md**](./CHANGELOG.md) — auto-generated milestone timeline
- [**RELEASING.md**](./RELEASING.md) — Tauri build playbook
- [**PROJECT_PLAN.md**](./PROJECT_PLAN.md) — original strategic plan
- [**META_IMPROVEMENTS.md**](./META_IMPROVEMENTS.md) — variable-level improvement analysis
- [**README.md**](./README.md) — quickstart

## Ritual scripts

| Script | When to run |
|---|---|
| `scripts/kickoff.py` | Any time — one-command dashboard |
| `scripts/milestone.py <id> "<summary>"` | After every milestone |
| `scripts/batch_ritual.py <id> "<retro>"` | After every batch close |
| `scripts/metrics.py` | After seed edits (auto-runs in milestone.py) |
| `scripts/validate_system.py` | Inline in milestone.py |
| `scripts/validate_thermal.py` | Inline in milestone.py |
| `scripts/snapshot.py` | Inline in milestone.py |
| `scripts/changelog.py` | Before shipping — regenerates CHANGELOG |

## Session arc by the numbers

```
Session start:   20 vehicles ·  9 brands · 0  H / 19 M / 1 L · 14 milestones
Session end:     37 vehicles · 16 brands · 30 H / 6  M / 1 L · 22 milestones

Snapshots on disk:            15+
Subagent runs logged:         3 (total ~467k tokens)
Prompt templates versioned:   2 (d01_verify, d04_author)
Primary-doc corpus:           ~25 KB · ~6.4k resume-cold tokens
Thermal validator:            6/6 anchors green throughout
```

## How to resume

```bash
cd "~/wherever/EV dashboard"
./Start-EV-Dashboard.command      # dev server in Chrome
# or
./Start-Desktop-App.command       # real Mac window (3–5 min first Rust compile)
python3 scripts/kickoff.py        # dashboard view
```

When you're ready for the Mac `.app`:
```bash
npm run tauri:build
# output: src-tauri/target/release/bundle/macos/EV Dashboard.app
# drag to /Applications
```

## Optional upgrades (future sessions)

- **Open Charge Map key**: 2-min signup at openchargemap.org. Drop `VITE_OCM_KEY=<key>` into `.env.local` → live DCFC stations replace the 15 demo pins automatically.
- **App icon**: run `npm run tauri icon path/to/512.png` once; enables a proper `.app` build.
- **Weekly iZEV monitor**: `schedule` skill can run a monthly Exa check if the federal program resumes.
- **More vehicles**: dataset currently 37; `d04_author.md` prompt template scales to any number.
- **Vehicle photos**: one-shot subagent pass to resolve Wikipedia Commons URLs per vehicle.
- **PDF export**: `Cmd-P → Save as PDF` already works from the compare view.
