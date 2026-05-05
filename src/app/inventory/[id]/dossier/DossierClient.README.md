# DossierClient

The per-unit deep-dive page at `/inventory/[id]/dossier`. ~575 lines.
Renders the full purchase-decision dossier for a single unit: pricing
breakdown (cash / finance / lease tabs), incentive stack, charging-curve
chart, warmup-ramp chart, DC-charge-ramp chart, days-on-lot history,
print stylesheet, and keyboard shortcuts.

## What it renders

Tabbed deal paths:
- **Cash** — OTD line-item breakdown (msrp + freight + EVAP + deposit + tax)
- **Finance** — PMT-amortized monthly payment + total interest
- **Lease** — monthly + residual buyout + km cap

Below tabs: applicable-incentive list, recharts charging-curve overlay,
spec summary (range, kW peaks, battery chem, heat pump, weight), used-
listings deep-links (AutoTrader / Kijiji / Leasebusters), back-button.

Print stylesheet polished for 8.5×11 letter — `@page` + `page-break:
avoid` + URLs inlined after anchors so paper readers can type them.

## Props

Receives a single `ScoredUnit` from `page.tsx` server shell. Server
resolves dealer + buyerContext + applicable incentives + spec via
`loadScoredUnits(buyerContext)` and passes everything pre-computed.

## Keyboard shortcuts (added U1)

| Key | Action |
|---|---|
| `←` | Back to inventory |
| `→` | Next unit (same filter set) — TODO |
| `c` | Add/remove from compare tray |
| `Esc` | Close any open modal / back to inventory |

Input-tag guard (`document.activeElement instanceof HTMLInputElement`)
keeps shortcuts from firing while user types in a search box.

## What it depends on

- Recharts via `next/dynamic`: `ChargingCurveChart`, `WarmupRampChart`,
  `DcChargeRampChart` (loaded with `{ ssr: false, loading: () => chartFallback }`).
  This is the **−105 kB First Load JS win** from commit 3ea9d0c0.
- `@/lib/scoring` — `computeFinanceOtd`, `computeLeaseOtd`,
  `evapEligibleAmount`, `dealerPressureIndex`
- `@/lib/format` — currency / percent / date formatters
- `@/lib/thermal` — `realRangeKm` for projected winter range
- `@/lib/battery_degradation` — `projectedRangeAtYear` for the 3-year /
  5-year retention chips
- `@/components/UnitPhotoGallery` — lightbox on photo click

## What depends on it

`src/app/inventory/[id]/dossier/page.tsx` is the only consumer. The
route uses `generateStaticParams()` to pre-render all 100 units in the
Tauri export build.

## Performance + accessibility notes

- Recharts is the heaviest dep on this route. Keep new charts wrapped
  in `dynamic` to preserve the 176 kB First Load JS budget.
- All chart containers carry `aria-label` describing the chart.
- Print stylesheet hides keyboard-shortcut hint banner.
