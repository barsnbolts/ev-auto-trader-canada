# CHANGELOG

*Auto-generated from `LEARNINGS.md` via `scripts/changelog.py`.*
*Each row is one milestone close or batch retrospective. Full detail in LEARNINGS.*

## 2026-04-23

- **Batch BATCH-FINAL retrospective 📊** — All 6 batches now closed.
- **Milestone BATCH-3 completed ✅** — Used market surface shipped pragmatic: pre-filled search links per vehicle to AutoTrader.ca (Ontario filter, 15 results, sorted by price) + Kijiji cars + EV-Dat
- **Milestone BATCH-4 completed ✅** — Charge-stop planner shipped.
- **Milestone BATCH-2 completed ✅** — Live integrations shipped with graceful fallback.
- **Batch BATCH-6 retrospective 📊** — Shipping infrastructure done.
- **Milestone BATCH-6 completed ✅** — Packaging + ops scaffolding.
- **Batch BATCH-5 retrospective 📊** — Decision experience layer shipped.
- **Milestone BATCH-5 completed ✅** — Decision experience layer shipped in one patch.
- **Batch BATCH-1 retrospective 📊** — Subagent authoring template worked; 17 records at ~7.6k tokens each on average.
- **Milestone BATCH-1 completed ✅** — Dataset matured from 20 → 37 vehicles across 9 → 16 brands via subagent author.
- **Milestone F-MAP completed ✅** — Mega-patch: map panel + range rings + DCFC stations + trip-distance check in one batch.
- **Milestone F-hp completed ✅** — Per-vehicle heat_pump_min_effective_c override wired through.
- **Milestone F-03 completed ✅** — Confidence-badge tooltips upgraded to plain English so anyone (including Ian's mom) can read them.
- **Milestone I-INT completed ✅** — Integrated monitoring + learning + prompt-evolution layer across all systems.
- **Milestone D-01-ext completed ✅** — Extended Exa verification across remaining 15 vehicles × 3 fields.
- **Milestone D-01 completed ✅** — PILOT D-01 Exa verification pass: dispatched subagent to verify 5 vehicles × 3 fields (range_km, dc_charge_kw_max, msrp_cad) against web sources.
- **Milestone I-VAL completed ✅** — Three validation-infrastructure upgrades shipped together: (1) scripts/validate_thermal.py anchor-test harness — caught real drift on first run (hpMinC was -10°
- **Milestone I-17 completed ✅** — Validator now warns if any memory file's originSessionId frontmatter field looks malformed (too short, contains whitespace).
- **Milestone P-01 completed ✅** — Header caption no longer clips at narrow widths — added flex-wrap to the main header and whitespace-normal to the right-side caption.
- **Milestone F-02 completed ✅** — Cost-per-100km row added to Adjusted-for-Conditions section.
- **Milestone B-01 completed ✅** — Zustand persist middleware added to useAppStore.
- **Milestone I-04 completed ✅ — deepened self-learning loop** — Three additions that make the self-learning layer actually enforce itself, not just log:  1.
- **Milestone 3c completed ✅** — Charging-curve overlay chart built as pure-SVG component (no dependency).
- **Milestone 3b completed ✅** — Temperature + preconditioning slider wired into CompareView.
- **Phase 1 scaffold complete** — **Worked well:** - `CitedValue<T>` schema for every data field.
- **Seed expansion 14 → 20 (Milestone 1e) ✅** — Added 6 vehicles across 2 new brands (Volkswagen, Polestar).
- **Thermal physics model built (Milestone 3a) 🟡** — `src/lib/thermal.ts` is in and has a sanity-check test alongside (`thermal.test.ts`).
- **Shifted plan to milestone-sliced structure** — Ian rightly pointed out that big phases = few review gates = weak learning signal.
- **Self-learning system optimization pass** — Ian asked for a deep check on the feedback/self-learning systems.
- **Phase 1 visually validated ✅** — Chrome extension connected.
- **Capability audit + workflow change** — Ian added connectors and capabilities.
- **Major scope simplification — personal tool, not a shipped product** — Ian clarified this is a private tool for him and his mom to help with his EV purchase decision.
