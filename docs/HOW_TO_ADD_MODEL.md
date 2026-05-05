# How to add a new EV model

Step-by-step recipe for wiring a new vehicle (e.g. Hyundai Kona EV, Genesis
GV60, Kia EV4) end-to-end through scraper, units, specs, UI, and tests.

> Tier scope reminder: long-range trims only. One entry per generation,
> never collapse refresh years. See `CLAUDE.md` non-negotiable principle 4.

## 1 · Constants

`src/lib/constants.ts`:

```ts
export const MODELS = ["EV6", "Ioniq5", "Ioniq6", "EV9", "Ioniq9", "KonaEV"] as const;
export const MODEL_LABEL: Record<Model, string> = {
  ...,
  KonaEV: "Hyundai Kona EV",
};
export const MODEL_BRAND: Record<Model, "Kia" | "Hyundai"> = {
  ...,
  KonaEV: "Hyundai",
};
```

## 2 · Specs

`data/specs.json`: append entries per generation × trim. Required fields
mirror existing entries — see `src/lib/types.ts` `Spec` type.

```json
{
  "model": "KonaEV",
  "year": 2026,
  "trim": "Preferred AWD Long Range",
  "drivetrain": "AWD",
  "msrpCad": 49995,
  "rangeKm": 420,
  "batteryKwh": 64,
  "hasHeatPump": "yes",
  "...": "..."
}
```

Run `npm run schema-audit` to verify no orphan fields.

## 3 · Default OEM pricing

`data/oem-pricing.json` `msrp.<Model>.<trim>` — fallback when specs.json
misses a year. Used by build_units_from_at when spec-lookup misses.

## 4 · AutoTrader scrape

`scripts/scrape_autotrader.py`:

```python
SEARCH_URLS = [
  ...,
  ("Hyundai", "Kona EV", "https://www.autotrader.ca/cars/hyundai/kona-ev"),
]
```

`scripts/build_units_from_at.py`:

```python
AT_MODEL_MAP = {
    ...,
    "KONA ELECTRIC": "KonaEV",  # AT writes "Kona Electric" — confirm via probe
}

TRIMS = {
    ...,
    "KonaEV": ["Essential", "Preferred", "Preferred AWD Long Range", "Limited AWD"],
}

FREIGHT = {"Kia": 1995, "Hyundai": 2095}  # already covers Kona
```

If trim parsing needs custom heuristics, extend `match_trim()` with a
new model branch (mirror the existing Ioniq5/EV9 branches).

## 5 · UI

`src/data/vehicle-images.json` — append `KonaEV` image URL (or omit; UI
falls back to a placeholder).

`src/lib/aliases.ts` (if exists): map any used-listings third-party
strings → `KonaEV`.

## 6 · Cross-listings

`scripts/merge_cross_sources.normalize_model()`:

```python
aliases = {
    ...,
    "konaelectric": "konaev",
    "konaev": "konaev",
}
```

`src/lib/crossListings.ts` Source enum doesn't change — model is per-entry.

## 7 · Tests

Add a smoke spec:

```ts
// scoring.test.ts
const u = baseUnit({ model: "KonaEV", trim: "Preferred AWD Long Range" });
const breakdown = computeOtd(u, dealer, [], "ON");
expect(breakdown.total).toBeGreaterThan(0);
```

Run `npm test:run` — all 100+ specs should still pass.

## 8 · Predeploy gate

```bash
npm run predeploy   # typecheck + thermal + schema + 100+ specs + build
```

Schema audit will reject the new model if SUPPORTED_YEARS doesn't
include any of its spec entries' years — bump `SUPPORTED_YEARS` in
`scripts/validate_data_schemas.py` if adding old MYs.

## 9 · Verify in /inventory

```bash
npm run dev   # http://localhost:1420 (or :3000 via Claude Preview)
```

Filter to the new model. Confirm:
- MSRP shows correctly (not $0 placeholder).
- Trim chip renders.
- Photo loads (or graceful placeholder).
- OTD line items add up.

## 10 · Cron picks it up automatically

Once shipped, `refresh_daily.sh` walks SEARCH_URLS, the new entry's
listings flow through `build_units_from_at` → `merge_cross_sources` →
UI. No further wiring.
