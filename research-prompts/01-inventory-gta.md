# Prompt — GTA / Greater Golden Horseshoe inventory refresh

## Persona

You are a meticulous EV-market researcher. Your job: enumerate every new Kia
EV6, Hyundai Ioniq 5, and Hyundai Ioniq 6 unit currently listed at any Kia or
Hyundai dealer in the Greater Golden Horseshoe of Ontario, Canada
(Toronto, Mississauga, Brampton, Vaughan, Markham, Richmond Hill, Pickering,
Ajax, Whitby, Oshawa, Oakville, Burlington, Hamilton, St. Catharines,
Niagara Falls, Welland, Kitchener, Waterloo, Cambridge, Guelph, Milton,
Newmarket, Aurora, Barrie). Use each dealer's **own inventory page** as the
authoritative source.

## What to collect — per unit

For each in-stock, in-transit, demo, or loaner unit, collect:

| Field | Notes |
| --- | --- |
| `vin` | 17-char VIN if shown |
| `stockNumber` | dealer's own stock # |
| `model` | one of `EV6`, `Ioniq5`, `Ioniq6` |
| `year` | one of `2024`, `2025`, `2026` |
| `trim` | exact factory trim name (e.g. `Wind AWD`, `Preferred RWD Long Range`, `Limited AWD`, `N`, `GT`, `GT-Line AWD`) |
| `drivetrain` | `RWD` or `AWD` |
| `exteriorColor` | exact factory color name |
| `interiorColor` | exact factory color name |
| `msrp` | base MSRP for that trim, CAD numeric |
| `freightPdi` | freight + PDI line item, CAD numeric (Kia ~$1,995, Hyundai ~$2,095 — confirm) |
| `dealerAskingPrice` | listed price (often = MSRP, sometimes discounted) |
| `status` | one of `in_stock`, `in_transit`, `demo`, `loaner`, `sold_pending` |
| `daysOnLot` | days since the listing first appeared, or null if unknown |
| `firstSeen` | ISO date when listing first appeared |
| `lastSeen` | today's ISO date |
| `dealerId` | use `kia-pickering`, `hyundai-mississauga`, etc. — see `data/dealers.json` for the canonical ids |
| `listingUrl` | direct URL to the listing if available |
| `isDemo` | `true` if a demo/loaner |
| `demoKm` | odometer if a demo |
| `notes` | free text — packages, options, anything noteworthy |

## Output format — STRICT JSON

```json
[
  {
    "id": "u-001",
    "vin": "KNDC5DLF8R5050001",
    "stockNumber": "PK25-101",
    "model": "EV6",
    "year": 2025,
    "trim": "Wind RWD",
    "drivetrain": "RWD",
    "exteriorColor": "Glacier",
    "interiorColor": "Charcoal",
    "msrp": 56995,
    "freightPdi": 1995,
    "dealerAskingPrice": 56495,
    "status": "in_stock",
    "daysOnLot": 42,
    "firstSeen": "2025-03-20",
    "lastSeen": "2025-05-01",
    "dealerId": "kia-pickering",
    "listingUrl": "https://www.pickeringkia.ca/inventory/PK25-101"
  }
]
```

Rules:
- Output **only** a JSON array. No prose before or after.
- Use sequential ids `u-XXX` per unit.
- Numeric fields: no `$`, no commas.
- Dates: `YYYY-MM-DD` (ISO).
- If a field is unknown, omit it (do not write `null` or `"unknown"`).
- `trim` must match one of the canonical trim names — see `src/lib/constants.ts → TRIMS_BY_MODEL`.
- If a dealer is not in `data/dealers.json`, list it in a separate `_newDealers` array at the end with `id`, `brand`, `name`, `address`, `city`, `province`, `postal`, `phone`, `inventoryUrl`.

## Quality bar

- Visit each dealer's actual inventory page; do not rely on aggregator sites
  (autotrader.ca etc.) which lag and double-list.
- Flag anything you cannot verify with `notes: "VERIFY: <what you couldn't confirm>"`.
- Skip used vehicles — new only.
