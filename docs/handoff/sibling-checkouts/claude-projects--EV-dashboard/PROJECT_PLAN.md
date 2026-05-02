# EV Dashboard — Project Plan (v2)

**A standalone Mac desktop app to compare every EV, PHEV, and EREV for sale in Canada (new + used), with a showroom-style browse, dense spec-compare view, a physics-accurate temperature/preconditioning slider, and an Apple-MapKit map with range rings, live charger pins, and (later) trip planning.**

Built for: Ian McAdam, Ontario — first-time EV buyer replacing an ICE vehicle.
Last updated: 2026-04-23.

---

## 1. Guiding principle — scientific rigor is non-negotiable

Ian will make a real purchase decision with this tool. Every number displayed must be traceable to an independently-verified source, and the temperature/preconditioning slider must be physics-informed — not a cosmetic curve.

**What this means operationally:**

- Every spec field in the dataset (range, usable kWh, peak DC kW, port type, tow rating) must be cross-checked against at least two independent sources before it lands in the database. Manufacturer marketing is a third opinion, not a source of truth.
- Range figures are labeled by test protocol: **EPA** (North American, what Canadian buyers actually experience), **WLTP** (European, optimistic for us), **Real-world** (community-observed). Never silently convert between them.
- Every vehicle gets a confidence flag (High / Medium / Low) for its winter model. If we don't have data to calibrate it, we say so rather than fabricate precision.
- Web-sourced facts get cited in a code comment next to the data, so we can re-validate when the source updates.
- When hunting data we are ruthless: cross-reference OEM spec sheets, NRCan FuelEconomy.ca, EPA fueleconomy.gov, EV-Database.org, Recurrent Auto fleet reports, Geotab Winter EV Range dataset, ABRP vehicle parameters, P3 Group charging tests, Bjørn Nyland 1000 km challenges, Out of Spec Reviews, InsideEVs independent tests, Fastned stats.

## 2. Feature set (locked in)

**Main page:** Standard filter bar across the top (price, powertrain type, body style, charging port, drivetrain, year). Below, a vertically-scrolling list grouped by brand — each brand shows its models underneath like a buyer's directory.

**Trim scope:** For every model, include only the *longest-range single-motor variant* (RWD or FWD, whichever the model offers) and the *longest-range AWD variant*. Skip base/standard-range trims. Skip performance/tri-motor/quad-motor trims. Some models will have one entry (e.g., F-150 Lightning — AWD only), some two (e.g., Model 3 LR RWD + LR AWD).

**Generations are distinct entries.** IONIQ 5 pre-2025 vs IONIQ 5 2025+, Model 3 Highland vs pre-Highland, Rivian R1 Gen1 vs Gen2, Mach-E 2021 vs 2024 refresh, etc. Battery chemistry, thermal management, and charging curves change across generations — collapsing them would break accuracy.

**Compare tray:** Pull up to 4 vehicles into a dense side-by-side spec view. Charging curves overlaid on a single kW-vs-SoC graph. All numbers live-update with the slider.

**Temperature + preconditioning slider:** -40 °C to +40 °C slider, with a preconditioning on/off toggle per compared vehicle. Drives live recalculation of range, Le/100 km, DCFC stop time, charging-curve peak, usable kWh. Details in §4.

**Map panel (Apple MapKit JS):** Your location pinned. Concentric range rings per compared vehicle, color-matched to the compare tray. DCFC station pins from Open Charge Map inside the rings, color-coded by max kW. Station occupancy / "busy" status overlaid where we can get it (Tesla Supercharger API for Tesla, PlugShare-style community data elsewhere — coverage is partial and we'll label it).

**Canadian pricing & incentives:** MSRP from manufacturer, federal iZEV (verify current 2026 status on every refresh), provincial incentives where applicable. Disclaimer and source link on every incentive figure.

**Cost-per-100km in real Ontario dollars:** Tied to your home electricity rate, recalculating with the slider.

**Used market (Phase 4):** AutoTrader.ca + Kijiji nationwide. Listing count, median asking price, cheapest 5 / nearest 5 with links back to source.

**Trip planning (Phase 5):** Pick destination, render route line on MapKit, per-vehicle charge-stops with estimated stop times and live station occupancy. Route engine chosen at Phase 5 time — ABRP API is the leading candidate (EV-routing industry standard); self-built fallback (Mapbox Directions + Open Charge Map + our charging-curve math) is on the table if we want zero dependencies.

**Explicitly out of scope:** Turn-by-turn live nav while driving. Winter-tire range toggle (dropped per Ian — keeps accuracy focus sharp).

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Tauri 2** | Native Apple Silicon performance, ~10 MB bundle, system WebKit — far better than Electron on your Mac. |
| UI | **React + TypeScript + Vite** | Mainstream, great AI-assisted-coding support, fast HMR. |
| Styling | **Tailwind + shadcn/ui** | Clean showroom aesthetics, consistent dense tables. |
| State | **Zustand** | Minimal boilerplate, enough power for filter/compare/slider state. |
| Tables | **TanStack Table** | Best-in-class for dense side-by-side compare. |
| Charts | **Recharts** (or **visx**) | Charging-curve overlays, slider-driven graphs. |
| Map | **Apple MapKit JS** | Native Mac look, free, no API-key pain for personal use, beautiful defaults. |
| Scrapers | **Python + Playwright + BeautifulSoup** | Best scraping ecosystem; handles JS-heavy OEM sites. Runs as Tauri sidecar. |
| Local DB | **SQLite** (`better-sqlite3` in app, `sqlite3` in Python) | File-based, zero-config, perfect for this dataset size. |
| Packaging | **Tauri bundler** → signed `.dmg` | Proper installable Mac app. |

## 4. The physics-accurate slider — how we actually build it

Per vehicle+generation, we store a small parameter set:

```
thermal_profile
  base_efficiency_whkm       # kWh/100km at 20°C, steady-state highway
  battery_chemistry          # LFP | NMC | NCA | LMR
  thermal_management         # active_liquid | passive | active_refrigerant
  has_heat_pump              # bool
  heat_pump_min_effective_c  # below this, HP switches to resistive (e.g. Tesla -10°C)
  cold_derate_curve          # array of {temp_c, pct_range_retained} observed points
  precon_time_by_temp        # minutes to precondition battery for DCFC at [0, -10, -20, -30]
  precon_thermal_gain        # % DCFC peak recovered when preconditioned vs cold-soaked
  charging_curve             # array of {soc_pct, kw_20c, kw_cold} observed points
  hvac_draw_kw_by_temp       # HVAC power pull at ambient temperatures
  sources                    # array of URLs/citations backing each of the above
  confidence                 # High | Medium | Low
```

**Range at a given slider state = f(rated_range, ambient_temp, preconditioned, hvac_on, chemistry_penalty, heat_pump_bonus).**

The function is the sum of well-understood physical effects — battery capacity derate with temperature (published per chemistry, validated against Geotab), HVAC draw (Recurrent Auto's data is excellent here), regen loss when cold, plus a per-vehicle calibration constant fit to observed winter tests. Not hand-wavy.

**When calibration data is thin:** we fall back to a chemistry-+-thermal-system baseline curve, flag the vehicle as Medium or Low confidence, and surface that in the UI so you can see where the number is guessed vs measured.

**Charging curve under temperature:** we store the 20 °C curve as published/tested, plus a cold-soaked curve from community tests. Preconditioning toggle blends between them. When only the warm curve exists, confidence drops and we say so.

## 5. Phased build roadmap

| Phase | Goal | Headline deliverable |
|---|---|---|
| **1** | MVP installable Mac app | Tauri + React + Tailwind scaffold, SQLite, curated seed of ~20 top Canadian EV/PHEV/EREV vehicles (Long Range trims only, with generation splits), brand-grouped list, compare tray, static spec view, first signed-or-unsigned `.dmg`. |
| **2** | Automated ingestion for all models | Python scraper framework — one module per OEM Canadian site, plus EV-Database.org. Generation-aware normalization. Refresh button wired up. Confidence flags seeded. |
| **3** | The physics slider + map | Per-vehicle thermal profiles. Slider-driven live recalculation across the compare tray. Apple MapKit panel with range rings + OCM DCFC pins + occupancy where available. Charging-curve overlay chart. Cost-per-100km tied to ON electricity rate. |
| **4** | Used market | AutoTrader.ca + Kijiji nationwide scrapers with rotating headers + throttling + graceful degradation. Per-model listing panels. |
| **5** | Trip planning | Destination picker, route rendering on MapKit, per-vehicle charge-stop plan with live station-occupancy flags. Engine decision (ABRP vs self-built) made at phase start. |
| **6** | Polish & package | Signed/notarized `.dmg`, auto-update scaffolding (optional), install guide, troubleshooting. |

Each phase ends with a usable app. You can stop at any phase and still have a tool worth opening.

## 6. Data model (updated)

```
brands            (id, name, country, logo_url)

vehicles          (id, brand_id, model, generation_label, year_start, year_end,
                   powertrain BEV|PHEV|EREV, body_style,
                   drivetrain_variant SINGLE_MOTOR|AWD)
  -- one row per generation × drivetrain; base/performance trims excluded

specs             (vehicle_id, battery_kwh_total, battery_kwh_usable, battery_chemistry,
                   range_km_epa, range_km_wltp, ac_charge_kw_max, dc_charge_kw_max,
                   port_type, seats, cargo_l_up, cargo_l_down, tow_rating_kg,
                   weight_kg, drive_wheels, seats)

thermal_profile   (vehicle_id, base_efficiency_whkm, thermal_management,
                   has_heat_pump, heat_pump_min_effective_c,
                   precon_thermal_gain_pct, confidence)

thermal_points    (vehicle_id, metric, temp_c, value, source_url, source_name)
  -- stores the cold_derate_curve, precon_time_by_temp, hvac_draw_kw_by_temp
  -- as flat (temp, value) rows with citations

charging_curves   (vehicle_id, preconditioned bool, soc_pct, kw, source_url)

pricing           (vehicle_id, msrp_cad, federal_izev_cad, provincial_rebate_cad,
                   effective_price_cad, as_of_date, source_url)

used_listings     (id, vehicle_id, year, km, price_cad, province,
                   source AutoTrader|Kijiji, url, seen_at)

sources           (id, url, name, accessed_at, notes)
  -- central citation table; everything else FKs to this
```

## 7. Risks and how we handle them

- **Federal iZEV rebate** was paused in early 2025 and its 2026 status is unclear. App always shows "verify on transport.canada.ca" with a live link; cache the verified state per refresh.
- **Ontario has no active provincial rebate** as of 2026 — app reflects this honestly.
- **AutoTrader.ca / Kijiji hostile to scrapers.** Modular per-source design; one broken scraper does not crash the run. Personal-use only.
- **Real-time charger occupancy is patchy** across networks. We label each station pin with the source of its status and an age-of-last-update. No fake green dots.
- **Thin winter data for new models.** Confidence flags in the UI; explicit "calibrated against N data points" hover tooltip.
- **Apple notarization cost.** Unsigned `.app` runs locally fine (right-click → Open once). Proper signed build requires the $99/yr Apple Developer account — optional, your call when we get to Phase 6.

## 8. What I need from you before I start Phase 1

1. Any models you already know you want in the seed set of 20? (Otherwise I'll pick the most cross-shopped Canadian-market EV/PHEV/EREV vehicles for 2026 across mainstream + premium.)
2. What Ontario city (or postal code) should I use as your default "home" location for the map and for the default Ontario electricity rate?
3. Are Node.js, Python 3.11+, and Rust already installed on your MacBook, or should Phase 1 include a one-command setup script that installs anything missing?

Give me those three answers and I'll scaffold Phase 1 end-to-end.
