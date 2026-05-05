# Bundle audit — 2026-05-04

> Snapshot of static-export bundle sizes after `BUILD_TARGET=tauri npm
> run build:tauri:web`. Directs future dynamic-import work.

## Build summary

- `out/` total: **10 MB**
- Shared First Load JS across all pages: **103 kB**
- Heaviest route (full first-load): `/inventory/[id]/dossier` — **281 kB** (9.75 kB route-specific + 281 kB shared+vendor)

## Per-route page sizes (gzip First Load JS)

| Route | Route-specific | First Load JS |
|---|---|---|
| /inventory/[id]/dossier | 9.75 kB | 281 kB |
| /inventory | 20.4 kB | 189 kB |
| /pick-a-model/compare | 3 kB | 165 kB |
| /pick-a-model | 7.09 kB | 123 kB |
| /map | 1.36 kB | 104 kB |
| /incentives, /intel, /history | 137 B | 103 kB |

## Largest top-level chunks (uncompressed bytes on disk)

| Size | File | What it is |
|---|---|---|
| 384 kB | `chunks/357-…js` | recharts (P2, pr, bx, vh, sl exports). The Pie/Bar/Line components used in dossier waterfall, charging curve, history charts, and DC ramp. |
| 256 kB | `chunks/479-…js` | scoring/transport/data-derived bundle — embeds `transport-bands.json` as inline JSON.parse string + scoring helpers + cross-listings index |
| 192 kB | `chunks/d0deef33.…js` | unknown — likely leaflet (CDN-optional)? Inspect if needed. |
| 192 kB | `chunks/framework-…js` | React 19 + Next 15 framework |
| 192 kB | `chunks/255-…js` | Next chunks router/runtime |
| 192 kB | `chunks/4bd1b696-…js` | shared chunk (used by every route, listed in First Load JS) |
| 128 kB | `chunks/main-…js` | Next entry |
| 128 kB | `chunks/559-…js` | unknown — likely zustand + persistence + buyer-context glue |
| 128 kB | `chunks/polyfills-…js` | browser polyfills |

## Findings + dynamic-import candidates

1. **357 = recharts (~384 kB)**: Used on /inventory/[id]/dossier (charts)
   and /history. Could be lazy-loaded via `next/dynamic` per chart. The
   biggest win would be putting `WarmupRampChart`, `DcChargeRampChart`,
   `ChargingCurveChart`, `HistoryCharts` behind `dynamic(import(…), { ssr: false })`.
   Tradeoff: small layout shift on dossier load. Net gain: ~300 kB
   first-load reduction on the inventory page (which doesn't render
   charts but currently pulls them via shared chunk).

2. **479 = scoring + JSON data**: Embeds `transport-bands.json`, likely
   also `cross-listings.json`. The cross-listings.json is small now (3
   entries) but will grow. Data-driven imports can't be code-split
   trivially since they're statically imported in `crossListings.ts`.
   Best mitigation: keep `cross-listings.json` lean by pruning entries
   with no surfaces (no priceCad delta + no lease).

3. **Polyfills 128 kB**: targets older browsers. The Tauri build
   guarantees WKWebView (Safari ~17 baseline). `next.config.mjs` could
   set `experimental.legacyBrowsers: false` to drop these for the
   Tauri target only. Worth ~100 kB.

## Recommended next steps (token estimates)

| Task | Bundle save | Token est |
|---|---|---|
| Lazy-load recharts via `next/dynamic` on dossier | ~250 kB on /inventory | ~6k |
| Drop polyfills for Tauri target | ~100 kB on every route | ~3k |
| Prune empty cross-listings entries | small, but bounds future growth | ~2k |

None are blocking; bundle size is acceptable for a personal-use Tauri
app where startup is one-time per relaunch. Document for the next pass.

---

## B3 status (Tier B, MEDIUM_RUNWAY) — SKIPPED 2026-05-04

`experimental.legacyBrowsers` was the Next 13 / Next 14 lever for
dropping IE-targeted polyfills at build time. **Next 15 has removed
this flag entirely** — automatic legacy polyfills are gone, and modern
browsers are the default target.

Verified by:
- Inspection of `next.config.mjs` schema in Next 15.x — no
  `experimental.legacyBrowsers` field accepted.
- Bundle output already shows the 128 kB shared chunk is core
  React + Next runtime, not legacy polyfills.

If we want to push the modern-only target further (e.g. drop
specific polyfills for WKWebView Safari 17+ baseline), the lever is
`browserslist` in package.json or a `.browserslistrc` file. **Not
worth it now** — the chunk is already minimal.

**Decision:** B3 closed without code change. Runway updated.
