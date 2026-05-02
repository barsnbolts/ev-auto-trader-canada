# Existing tools we could integrate — 2026-04-24 sweep

*Captured from the Cluster H research pass. Before building anything >30 min, re-check this list.*

## Top 10 high-ROI integrations

1. **NHTSA vPIC API** — https://vpic.nhtsa.dot.gov/api/
   - VIN decoder: make, model, year, plant. Free, no registration, 99% accuracy 1995+.
   - ROI: saves ~5 hours vs building a VIN parser. Useful for used-market flow.

2. **OpenEV Data (GitHub)** — https://github.com/open-ev-data/open-ev-data-dataset
   - Community-maintained EV specs in JSON/CSV/SQL. Apache 2.0, strict schema, can be self-hosted.
   - ROI: replaces manual seed.json maintenance for non-Canadian-specific fields. Target for Cluster I.

3. **NRCan Fuel Consumption API** — https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64
   - Official Canadian vehicle efficiency ratings (includes EVs kWh/100 km). CSV/JSON, quarterly updates.
   - ROI: official source for Canadian data; removes drift risk on federal-test numbers.

4. **Apify PlugShare scraper** — https://apify.com/parseforge/plugshare-scraper
   - Live DCFC station data with 20+ fields per station. Free tier ($5 credit, 10 items/run).
   - ROI: PlugShare API is commercial-only; scraper gives live data without a partnership. Candidate for Cluster L.

5. **TanStack Query v5** — https://tanstack.com/query/latest
   - Caching, mutations, background refetch, devtools. Replaces ad-hoc fetch logic.
   - ROI: cleaner OCM/Exa caching, devtools cuts debug time in half. Drop-in for most of our fetch calls.

6. **MapLibre GL (Metal backend)** — https://maplibre.org/roadmap/maplibre-native/metal/
   - Open-source Leaflet alternative with Metal GPU acceleration. 40–60% FPS improvement on M1/M2+.
   - ROI: drop-in-ish Leaflet replacement, Metal is native on Tauri macOS. Candidate for Cluster J.

7. **Rust `tracing` crate + tracing-appender** — https://docs.rs/tracing/ + https://docs.rs/tracing-appender/
   - Rust structured logging, file rotation, flamegraph-ready.
   - ROI: **integrated in Cluster H** as `src-tauri/src/tracing_setup.rs`. No external plugin needed.

8. **Observable Plot** — https://observablehq.com/plot
   - Grammar-of-graphics chart library, 20+ curves including monotone-y (charging curves).
   - ROI: swap Recharts for cleaner charging-curve displays. Low-priority unless chart pain surfaces.

9. **Mapbox EV Charge Finder** — https://docs.mapbox.com/api/navigation/ev-charge-finder/
   - OCPI v2.2.1 live availability + pricing. USA-focused but expanding. Paid tier.
   - ROI: complements OCM if we ever build a premium trip planner. Not worth it for personal use now.

10. **Electrify Canada real-time data** — https://electrify-canada.ca/
    - Real-time charger occupancy via Google Maps integration. Canadian-specific.
    - ROI: free data, scrape-friendly for our Ontario fallback. Worth a look in Cluster L.

## Quick wins (minimal setup)

- **Zod** — we already use it. No change.
- **Playwright for Tauri E2E** — Tauri's official testing harness pairs with Playwright. Candidate for a Cluster K enhancement to replace our current log-replay drive_app.py.
- **@tauri-apps/plugin-log** — exists but `tracing` is lighter and already wired.

## Skip (not worth integrating)

- **Tesla Supercharger API** — only NEVI-funded sites are official; unofficial GraphQL reverse-engineering is fragile and TOS-risky.
- **EV Database API** — requires company registration. OpenEV Data covers the same ground freely.
- **ChargeHub API** — PlugShare scraper covers the same data at lower friction.

## Bottom line

Highest-ROI: OpenEV Data (Cluster I) + MapLibre Metal (Cluster J) + tauri tracing (done) + TanStack Query (low-effort swap, any cluster). Combined these save ~20 hours vs building equivalents.

## How to add to this file

New research sessions should:
- Append a new dated section at top (or start a new file `docs/research/<topic>_YYYY-MM-DD.md`).
- Always include: tool name, URL, free/paid status, one-line role, ROI note (hours saved or reason over current tool).
- Mark dead-ends too — prevents re-searching the same rabbit hole.
