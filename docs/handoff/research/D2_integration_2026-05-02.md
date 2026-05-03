# D2 integration smoke — closure (2026-05-02)

## Verdict: PASS (after one inline fix)

All 5 dynamic routes render server-side; 3-path OTD math reaches the
DOM; chip + deep-link wiring verified by code path AND HTML grep.

## Bug found + fixed inline

`/inventory` returned **500** on first probe. Cause: `next/image`
hostname guard rejected `upload.wikimedia.org` (only Ioniq6 hero shot
has a real URL; B2 used `next/image` for the hero column). Fix: added
`remotePatterns` entry to `next.config.mjs`:

```js
images: {
  remotePatterns: [{
    protocol: "https",
    hostname: "upload.wikimedia.org",
    pathname: "/wikipedia/commons/**",
  }],
}
```

Committed as `5c031cdd`. Re-probe: 200.

## Route status (post-fix)

| Route | HTTP | Notes |
|-------|------|-------|
| `/` | 200 | nav + buyer-context selector |
| `/inventory` | 200 | 25 rows in first paint; Dossier ×25, AutoTrader-deep-link ×250, Kijiji ×25, Cash ×25, Lease ×36, Finance ×13 |
| `/compare` | 200 | PaymentMatrix renders; Cash + Lease + Finance + OTD strings present |
| `/inventory/u-at-bdbc6d9d/dossier` (Ioniq5 LR) | 200 | Cash + Finance + Lease tabs all render; numbers visible: $1,022 finance, $663 lease |
| `/inventory/u-at-155ba53d/dossier` (EV9 Light RWD) | 200 | Cash + Finance + Lease tabs; $804 lease |
| `/inventory/u-at-fc69e5f7/dossier` (no-lease unit) | 200 | Cash + Finance render; "No lease" placeholder ×1 (correct fallback) |
| `/dealer/hyundai-calgary` | 200 | dealer page loads |

## Heat-pump chip render path

`InventoryTable.tsx:580` calls `<HeatPumpChip hasHeatPump={specByUnitId[u.id]?.hasHeatPump} />`.
Chip body (lines 81-100):
- `true` → returns `null` (no chip — default good case)
- `false` → renders `❌ No heat pump`
- `null`/`undefined` → renders `❓ Heat pump?`

Grep on first 25 inventory rows: 0 `❌` / 0 `❓`. Reason: only 3 of 27
specs have `hasHeatPump: false` (none `null`). Score-sort puts
heat-pump-positive units first; the 3 negatives are below the visible
fold. Code path verified by direct read; not a bug.

## Schema invariants

```
$ jq '[.[] | select(.scope == "lease_promo")] | length' data/incentives.json
2
$ jq '[.[] | select(.scope == "finance_promo")] | length' data/incentives.json
2
$ jq '[.[] | select(.scope == "loyalty")] | length' data/incentives.json
2
```

V5 §Verification gate: lease_promo ≥ 2 ✓, finance_promo ≥ 2 ✓, loyalty ≥ 2 ✓.

## OTD path coverage

Verified at runtime via dev-server HTML grep on `/inventory`:
- 25 rows render Cash badge
- 36 `Lease` mentions (badges + applicable promo links)
- 13 `Finance` mentions
- 3 `/mo` numerical badges (lease + finance subset of rows where
  `loadScoredUnits` populated `otdPaths.lease` / `.finance`).

Numerical badge count is low (3) because lease/finance promos apply
narrowly — 2026 Ioniq5 Preferred RWD LR (5 units) + 2026 EV9 Light RWD
(1 unit) + 2026 EV6 ALL trims (subset). Working as designed.

## Closure

Phase D2 = PASS. Project Claude-side complete. Remaining work is two
USER actions documented in `POST_HIGH_RESUME_2026-05-02.md`:
- Install daily refresh launchd agent
- First-time Vercel deploy

## Files touched

- `next.config.mjs` — `images.remotePatterns` for Wikipedia Commons
- `docs/handoff/research/D2_integration_2026-05-02.md` — this file
- `docs/handoff/POST_HIGH_RESUME_2026-05-02.md` — final status bump
