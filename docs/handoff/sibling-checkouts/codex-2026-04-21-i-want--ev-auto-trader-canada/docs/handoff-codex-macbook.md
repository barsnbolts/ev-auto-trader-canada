# Handoff: continue in Codex MacBook Pro app

This file is the complete handoff for everything discussed and built so far, so you can continue in one place.

## 1) What is already implemented
- Offline preview server with no external packages (`npm run preview:offline`).
- Required preview sections:
  - top nav sections,
  - sample vehicle cards,
  - compare table,
  - missing-data summary,
  - data provenance/sample-mode notice.
- Mac launcher (`start.command`) for double-click startup.
- In-repo artifact packager (`npm run bundle:offline`) that writes to `artifacts/`.
- Sample data source at `data/vehicles.sample.json`.
- Health checks and status docs.

## 2) Locked product decisions (from today)
- Region default: Ontario.
- Radius/filter modes: 100 km (default), 150 km, provincial, national.
- Units/currency: kilometers only, CAD MSRP.
- Language: English only.
- Compare: factual side-by-side, no scoring.
- Confidence labels: High / Medium / Low.
- Include coming-soon models in main browse list and allow selecting them in compare.
- Desktop-first design.
- Temperature slider default: 22°C.
- Preconditioning toggle required.
- Show city/highway/combined estimates.
- Show L1/L2/L3 charging behavior and always show 10–80%.

## 3) Product scope we are building toward
- Dealership-style UI for EV/PHEV/EREV browsing and compare.
- Brand -> model -> trim hierarchy with:
  - RWD Long Range,
  - AWD Long Range,
  - Other trims.
- Temperature-aware range display with preconditioning state.
- Charging visibility: common kW tiers + 10–80 + ramp notes.
- Provenance + confidence for values.

## 4) Ordered execution plan (strict gates)
Run in this order:
1. Data schema + validation.
2. Canonical dataset + provenance model.
3. Temperature/preconditioning engine.
4. Charging engine (L1/L2/L3 + 10–80).
5. Dealership UI + filters + compare + detail.
6. QA, confidence calibration, and docs.

Only after gates pass, parallelize non-blocking polish tasks.

## 5) Tasks that can be parallelized later
- Visual polish and typography.
- Additional source collection.
- Regression snapshots.
- Documentation cleanup.

## 6) Acceptance criteria for “usable finished product”
The product is considered usable when all are true:
- App launches in this environment with one command.
- Browse by brand/model/trim works.
- Location modes (100/150/provincial/national) work.
- Temp slider + preconditioning toggle update values.
- Compare table shows MSRP, range metrics, charging metrics.
- Confidence labels are visible for key values.

## 7) Continue-now commands (Codex MacBook app)
```bash
cd ev-auto-trader-canada
npm run preview:offline
```

If you need a zipped transfer package from inside the repo:
```bash
npm run bundle:offline
```
Outputs:
- `artifacts/offline-preview.html`
- `artifacts/ev-auto-trader-canada-offline.zip`

## 8) Current limitation (explicit)
This repository is currently an offline preview foundation and not yet the fully implemented live-data dealership app. The plan above is the exact build path to get there.
