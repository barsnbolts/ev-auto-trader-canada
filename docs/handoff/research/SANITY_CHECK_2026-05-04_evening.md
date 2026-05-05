# R5 — sanity check of existing decision docs · 2026-05-04 evening

## Files re-validated

- `docs/handoff/research/LEASEBUSTERS_VIN_DECISION_2026-05-04.md` (74 LOC)
- `docs/INVARIANTS.md` (146 LOC)
- `scripts/merge_cross_sources.py` (236 LOC)
- `data/cross-listings.json` (3 entries currently)
- `data/_kijiji_raw.json` (251 entries)
- `data/units.json` (100 AT-derived entries)

## Headline corrections to the audit

The audit said "Cross-listings broken (3 entries vs ~250 possible — trim-fuzz bug)." That diagnosis is **partially right** but missed the bigger picture. Real findings:

### F1. AutoTrader VIN coverage is 8 %, not 97 %

Empirical: `jq '[.[] | .vin // "NONE"] | group_by(. == "NONE") | map({has_vin: (.[0] != "NONE"), count: length})' data/units.json`
→ `[{has_vin: true, count: 8}, {has_vin: false, count: 92}]`

92 of 100 AT units have **no VIN** at all. The /tmp blob from May 1 (the bootstrap source) only carries 8 VINs forward. **This means VIN-keyed merge alone cannot fix things — most AT entries can never VIN-match.**

(Kijiji is 251/251 = 100 % VIN coverage. Confirmed.)

### F2. The merge code never VIN-keys at all

`scripts/merge_cross_sources.py:132` — `key = fallback_key(...)`. VIN is **stored** on the entry but **never used as a join key**. The "VIN preferred, fallbackKey otherwise" invariant in `INVARIANTS.md:67` is documented but **not implemented**. INVARIANTS.md is documenting a contract the code does not honor.

### F3. Trim-format mismatch is the dominant join-killer

Same 2026 EV9 vehicle, both sources:

| Source | Trim string |
|---|---|
| Kijiji | `Land AWD w/ Plus Package` |
| Kijiji | `Land AWD w/ Premium Package` |
| Kijiji | `Land w/Premium Package Land w/Premium Package AWD` |
| AT | `Land Long Range AWD` |

After current `normalize_trim()` (lowercase + collapse-whitespace + hyphenate):

| Source | Normalized trim |
|---|---|
| Kijiji | `land-awd-w-plus-package` |
| Kijiji | `land-awd-w-premium-package` |
| Kijiji | `land-w-premium-package-land-w-premium-package-awd` |
| AT | `land-long-range-awd` |

All four are different fallback_keys. The cars are the same model trim. **Zero matches for EV9 cross-source today.**

### F4. The 3 cross-source matches that DO work

Empirical: only 3 fallback_keys collide across sources today —
- `2025|kia|ev6|land-awd`
- `2025|kia|ev6|wind-rwd`
- `2025|hyundai|ioniq6|preferred-rwd-long-range`

These are coincidences where AT and Kijiji happen to use the same trim phrasing.

### F5. Filter logic is correct

The merge filter (`len(sources) > 1 or has_lease`) works as intended. The 3 emitted entries truly have cross-source listings (e.g. entry 0 has 13 listings: AT + Kijiji mix). My initial spot-check looked truncated; full inspection confirmed.

## Updated I0b spec (supersedes original "trim fuzz")

The original I0b spec was "substring/prefix match for trim." That alone won't fix things because:
- The trim mismatch is too varied for substring matching to work robustly (e.g. "Land Long Range AWD" vs "Land w/Premium Package Land w/Premium Package AWD" share only "Land" + "AWD" tokens with very different semantics).
- VIN-key merge is missing entirely and would catch the 8 high-value AT VINs.

**New I0b spec — TWO independent fixes:**

### I0b-1 · Add VIN-keyed merge as primary join · ~3k tokens
Modify `merge_cross_sources.py` so:
1. Build `entries_by_vin: dict[str, dict]` alongside `entries: dict[str, dict]` (the current fallback-keyed dict).
2. Layering loop checks: if listing has VIN AND VIN exists in `entries_by_vin`, append to that entry. Else fall through to fallback-key path.
3. After all 3 sources layered, deduplicate entries with same VIN (an AT entry without VIN may have created a fallback-key entry that should merge with a Kijiji-VIN-keyed entry for the same car).
4. Expected lift: 8 high-value matches for the 8 AT-with-VIN units (assuming Kijiji has the matching VINs, which it usually will because Kijiji covers AT inventory).

### I0b-2 · Drop trim from fallback_key + add UI disambiguation · ~3k tokens
Modify `merge_cross_sources.py:fallback_key()`:
1. Drop trim from the key. New key shape: `year|make|model`.
2. Trim moves to per-listing display attribute (already there).
3. UI surface (`InventoryTable` cross-source chip): show "13 listings of 2025 Kia EV6 across sources, prices $X–$Y, your AT entry is $Z (rank N)."

Expected join rate jump: from 3 to ~30-50 cross-source matches. Trade-off: some false positives (Kia EV6 Land AWD vs Kia EV6 GT-Line AWD treated as same vehicle for cross-listings purposes). UI disambiguation handles it.

### Vitest specs
- `crossListings.test.ts` — VIN-key wins over fallback-key when both present.
- `crossListings.test.ts` — fallback-key collapses 5 trim variants of the same model under one entry.
- Update existing format-asymmetry spec — the asymmetry no longer matters because TS side never builds keys (only consumes them from JSON).

## Updated I0b risk

- Dropping trim from key risks a Polestar 2 LR Single being merged with Polestar 2 LR Dual under one cross-listing entry. Mitigation: per-listing trim is preserved + visible in UI; only the *aggregation* changes.
- Existing single-source AT entries (the 92 % VIN-less, trim-mismatched ones) are already invisible to UI today (filter excludes single-source). After fix, more entries become multi-source → more chips render. Sanity check: re-run vitest + manual /inventory walk.

## Leasebusters spec — still good

`docs/handoff/research/LEASEBUSTERS_VIN_DECISION_2026-05-04.md` is mechanical-enough for medium to execute solo. Spec's claim "VIN NOT exposed → keep fallbackKey approach" still aligns with new I0b-2 (drop trim from key). Leasebusters listings will join via 3-segment `year|make|model` key after I0b-2 ships, plus per-listing trim attribute for display.

## INVARIANTS.md — patch needed

Line 67-74 ("VIN preferred, fallbackKey otherwise") should be amended:
- Note that current code does NOT VIN-key (documents intent, not reality).
- Note that I0b-1 will make this true.
- Update line 70 fallback key shape from 4-segment to 3-segment after I0b-2.

Patch the file as part of I0b-2's commit, not separately.

## Updated TIER I0 token estimate

Original: ~29k. Revised: ~32k.

| Sub-task | Original | Revised |
|---|---|---|
| I0a cron PATH | 1k | 1k |
| I0b cross-listings | 3k | 6k (split into b-1 + b-2) |
| I0c wire kijiji into cron | 2k | 2k |
| I0d leasebusters rewrite | 6k | 6k |
| I0e AT scrape (probe + replay) | 15k | 15k |
| I0f end-to-end verify | 2k | 2k |

Still under the medium-tier budget; net cost of R5 is ~3k more for far-better outcome.
