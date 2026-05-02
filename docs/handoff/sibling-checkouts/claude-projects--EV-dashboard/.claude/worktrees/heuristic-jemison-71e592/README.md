# EV Dashboard

A standalone Mac desktop app to compare every EV, PHEV, and EREV for sale in Canada (new + used), with a showroom-style browse, a dense spec-compare view, a physics-accurate temperature/preconditioning slider, and a map with range rings and live charger pins.

Built for a first-time Canadian EV buyer who wants **traceable, scientifically rigorous** numbers — not marketing claims.

**Status:** Phase 1 MVP. See [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) for the full roadmap.

---

## Quick start (macOS)

One-command setup:

```bash
cd "$(dirname "$0")"       # or just: cd into this folder
chmod +x setup.sh
./setup.sh
```

The script checks for and installs anything missing: Homebrew → Node.js → Rust → Python 3.11+ → project npm packages.

Then run the app in either mode:

```bash
npm run dev          # fastest — opens in your browser at http://localhost:1420
npm run tauri:dev    # real Mac desktop window (first run compiles Rust, a few minutes)
npm run tauri:build  # produces an installable .dmg in src-tauri/target/release/bundle/
```

## What Phase 1 does

- Dark-themed, showroom-style main page with brand-grouped vehicle directory
- Filter bar: powertrain (BEV/PHEV/EREV), body style, max price, min range, full-text search
- Compare tray: pull up to 4 vehicles into a side-by-side spec sheet
- Only the longest-range single-motor and longest-range AWD trims are included per model
- Distinct entries for each major generation (IONIQ 5 2025 refresh, Tesla Model 3 Highland, Rivian R1 Gen2, etc.)
- Every number shows a confidence badge (High / Medium / Low) tied to data provenance
- Seed dataset of 15 vehicles across 7 brands

## What Phase 1 intentionally does **not** do yet

- No scraping (Phase 2). The seed is hand-curated with citations.
- No physics-accurate temp/preconditioning slider (Phase 3). Charging curves are stored at 20 °C only.
- No map (Phase 3).
- No used-market listings (Phase 4).
- No trip planning / routing (Phase 5).

## Project structure

```
EV dashboard/
├── PROJECT_PLAN.md         # Full multi-phase roadmap
├── README.md               # You are here
├── setup.sh                # One-command macOS dev-environment installer
├── package.json            # Frontend deps & scripts
├── index.html              # Vite entry
├── vite.config.ts
├── tailwind.config.js
├── src/                    # React + TypeScript frontend
│   ├── App.tsx
│   ├── main.tsx
│   ├── types.ts            # Vehicle / Spec / CitedValue types
│   ├── data/
│   │   ├── seed.json       # Hand-curated seed dataset (15 vehicles)
│   │   └── index.ts
│   ├── store/
│   │   └── useAppStore.ts  # Zustand store: filters + compare selection
│   ├── lib/
│   │   └── format.ts       # Display formatters (CAD, km, kW, kWh, kg, L)
│   └── components/
│       ├── FilterBar.tsx
│       ├── BrandList.tsx
│       ├── VehicleRow.tsx
│       ├── CompareTray.tsx
│       ├── CompareView.tsx
│       └── ConfidenceBadge.tsx
└── src-tauri/              # Rust + Tauri desktop shell
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    └── src/main.rs
```

## Data rigor — how numbers get into this app

Every field in `seed.json` is a `CitedValue` with:

```ts
{
  value: <number | boolean | null>,
  source: { url, name, accessed },
  confidence: "High" | "Medium" | "Low",
  notes?: "…why confidence is what it is…"
}
```

- **High** — independently cross-verified across at least two reputable sources.
- **Medium** — sourced from the manufacturer's Canadian site or a single reputable third party (EV-Database.org, EPA fueleconomy.gov, NRCan FuelEconomy.ca).
- **Low** — provisional, or the 2026 model-year figure is still emerging. **Always re-verify before purchase.**

Phase 2 replaces the hand-curated seed with a live scrape pipeline.

## Known limitations of the seed (as of 2026-04-23)

- **Federal iZEV rebate:** paused in early 2025; 2026 status unclear. All entries show $0 with a note to verify at `transport.canada.ca`.
- **Ontario provincial rebate:** none. Reflected honestly.
- **Tesla Model Y Juniper (2026):** specs still finalizing; entry is a placeholder.
- **Model-year 2026 MSRPs:** marked Low confidence — Tesla, Rivian, and others adjust pricing frequently.

See the in-app confidence badges and hover notes for per-field specifics.

## Troubleshooting

**`npm run tauri:dev` hangs on first run:** Rust is compiling Tauri's dependencies. First build takes 3–6 minutes on an Apple Silicon Mac; subsequent runs are near-instant.

**Port 1420 already in use:** kill the process with `lsof -ti:1420 | xargs kill -9`.

**Tauri build complains about missing icons:** icons aren't shipped in this scaffold. `npm run tauri icon path/to/your.png` will generate all required sizes once you have an icon to use.
